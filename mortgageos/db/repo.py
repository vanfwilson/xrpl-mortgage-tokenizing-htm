from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

SCHEMA_SQL = Path(__file__).with_name("schema.sql")


def _jsonb(v: Any) -> Jsonb:
    return Jsonb(v, dumps=lambda o: json.dumps(o, default=str))


class Repo:
    def __init__(self, dsn: str):
        self.conn = psycopg.connect(dsn, autocommit=True, row_factory=dict_row)

    def close(self) -> None:
        self.conn.close()

    def apply_schema(self) -> None:
        self.conn.execute(SCHEMA_SQL.read_text())

    def _one(self, sql: str, params: tuple = ()) -> dict | None:
        return self.conn.execute(sql, params).fetchone()

    def _all(self, sql: str, params: tuple = ()) -> list[dict]:
        return self.conn.execute(sql, params).fetchall()

    # loans ---------------------------------------------------------------------

    def upsert_loan(self, **loan: Any) -> None:
        cols = list(loan)
        sets = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols if c != "loan_id") + ", updated_at=now()"
        vals = [_jsonb(v) if isinstance(v, (list, dict)) else v for v in loan.values()]
        self.conn.execute(
            f"INSERT INTO mortgageos.loans ({', '.join(cols)}) VALUES ({', '.join('%s' for _ in cols)}) "
            f"ON CONFLICT (loan_id) DO UPDATE SET {sets}",
            vals,
        )

    def update_loan(self, loan_id: str, **fields: Any) -> None:
        sets = ", ".join(f"{c}=%s" for c in fields) + ", updated_at=now()"
        vals = [_jsonb(v) if isinstance(v, (list, dict)) else v for v in fields.values()]
        self.conn.execute(f"UPDATE mortgageos.loans SET {sets} WHERE loan_id=%s", [*vals, loan_id])

    def loan(self, loan_id: str) -> dict | None:
        return self._one("SELECT * FROM mortgageos.loans WHERE loan_id=%s", (loan_id,))

    def set_outstanding(self, loan_id: str, outstanding_cents: int) -> None:
        self.conn.execute("UPDATE mortgageos.loans SET outstanding_cents=%s, updated_at=now() WHERE loan_id=%s",
                          (outstanding_cents, loan_id))

    def set_loan_status(self, loan_id: str, status: str) -> None:
        self.conn.execute("UPDATE mortgageos.loans SET status=%s, updated_at=now() WHERE loan_id=%s", (status, loan_id))

    # issuer accounts -------------------------------------------------------------

    def upsert_issuer_account(self, account: str, role: str, *, escrow_enabled: bool, flags: int | None,
                              flag_tx_hash: str | None = None, last_error: str | None = None) -> None:
        self.conn.execute(
            "INSERT INTO mortgageos.issuer_accounts (account, role, escrow_enabled, flags, flag_tx_hash, last_error) "
            "VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (account) DO UPDATE SET role=EXCLUDED.role, "
            "escrow_enabled=EXCLUDED.escrow_enabled, flags=EXCLUDED.flags, "
            "flag_tx_hash=COALESCE(EXCLUDED.flag_tx_hash, mortgageos.issuer_accounts.flag_tx_hash), "
            "last_error=EXCLUDED.last_error, updated_at=now()",
            (account, role, escrow_enabled, flags, flag_tx_hash, last_error))

    def issuer_account(self, account: str) -> dict | None:
        return self._one("SELECT * FROM mortgageos.issuer_accounts WHERE account=%s", (account,))

    # issuances -----------------------------------------------------------------

    def insert_issuance(self, **row: Any) -> None:
        cols = list(row)
        vals = [_jsonb(v) if isinstance(v, (list, dict)) else v for v in row.values()]
        self.conn.execute(
            f"INSERT INTO mortgageos.mpt_issuances ({', '.join(cols)}) VALUES ({', '.join('%s' for _ in cols)}) "
            "ON CONFLICT (issuance_id) DO NOTHING",
            vals,
        )

    def issuance(self, issuance_id: str) -> dict | None:
        return self._one("SELECT * FROM mortgageos.mpt_issuances WHERE issuance_id=%s", (issuance_id,))

    def issuance_for(self, loan_id: str, purpose: str) -> dict | None:
        return self._one("SELECT * FROM mortgageos.mpt_issuances WHERE loan_id=%s AND purpose=%s ORDER BY created_at DESC LIMIT 1",
                         (loan_id, purpose))

    # ledger transactions ------------------------------------------------------

    def tx_pending(self, loan_id: str | None, tx_hash: str, envelope: dict) -> None:
        from ..ledger.memo import parse_memo
        self.conn.execute(
            "INSERT INTO mortgageos.ledger_transactions (tx_hash, loan_id, tx_type, account, sequence, state, memo, envelope) "
            "VALUES (%s,%s,%s,%s,%s,'Pending',%s,%s) ON CONFLICT (tx_hash) DO NOTHING",
            (tx_hash, loan_id, envelope.get("TransactionType", "?"), envelope.get("Account", "?"),
             envelope.get("Sequence"), Jsonb(parse_memo(envelope)), Jsonb(envelope)),
        )

    def tx_confirmed(self, tx_hash: str, result_code: str, ledger_index: int | None, meta: dict) -> None:
        self.conn.execute(
            "UPDATE mortgageos.ledger_transactions SET state='Confirmed', result_code=%s, ledger_index=%s, meta=%s, updated_at=now() "
            "WHERE tx_hash=%s", (result_code, ledger_index, Jsonb(meta), tx_hash))

    def tx_failed(self, tx_hash: str, result_code: str, detail: str) -> None:
        self.conn.execute(
            "UPDATE mortgageos.ledger_transactions SET state='Failed', result_code=%s, detail=%s, updated_at=now() WHERE tx_hash=%s",
            (result_code, detail, tx_hash))

    def tx(self, tx_hash: str) -> dict | None:
        return self._one("SELECT * FROM mortgageos.ledger_transactions WHERE tx_hash=%s", (tx_hash,))

    def tx_states(self, loan_id: str) -> dict[str, int]:
        rows = self._all("SELECT state, count(*) AS n FROM mortgageos.ledger_transactions WHERE loan_id=%s GROUP BY state", (loan_id,))
        return {r["state"]: r["n"] for r in rows}

    # audit ---------------------------------------------------------------------

    def audit(self, loan_id: str | None, phase: str, code: str, text: str, envelope: dict | None) -> None:
        self.conn.execute(
            "INSERT INTO mortgageos.audit_log (loan_id, phase, error_code, error_text, envelope) VALUES (%s,%s,%s,%s,%s)",
            (loan_id, phase, code, text, Jsonb(envelope)))

    def audit_rows(self, loan_id: str, phase: str | None = None) -> list[dict]:
        if phase:
            return self._all("SELECT * FROM mortgageos.audit_log WHERE loan_id=%s AND phase=%s ORDER BY id", (loan_id, phase))
        return self._all("SELECT * FROM mortgageos.audit_log WHERE loan_id=%s ORDER BY id", (loan_id,))

    # schedule / escrow legs ---------------------------------------------------

    def replace_schedule(self, loan_id: str, rows: list[dict]) -> None:
        self.conn.execute("DELETE FROM mortgageos.escrow_legs WHERE loan_id=%s", (loan_id,))
        self.conn.execute("DELETE FROM mortgageos.payment_schedule WHERE loan_id=%s", (loan_id,))
        with self.conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO mortgageos.payment_schedule (loan_id, period, due_date, pi_cents, principal_cents, interest_cents, tax_cents, ins_cents) "
                "VALUES (%(loan_id)s,%(period)s,%(due_date)s,%(pi_cents)s,%(principal_cents)s,%(interest_cents)s,%(tax_cents)s,%(ins_cents)s)",
                [{**r, "loan_id": loan_id} for r in rows],
            )

    def next_scheduled(self, loan_id: str) -> dict | None:
        return self._one("SELECT * FROM mortgageos.payment_schedule WHERE loan_id=%s AND status='Scheduled' ORDER BY period LIMIT 1", (loan_id,))

    def set_period_status(self, loan_id: str, period: int, status: str) -> None:
        self.conn.execute("UPDATE mortgageos.payment_schedule SET status=%s WHERE loan_id=%s AND period=%s", (status, loan_id, period))

    def insert_leg(self, **row: Any) -> int:
        cols = list(row)
        vals = [_jsonb(v) if isinstance(v, (list, dict)) else v for v in row.values()]
        r = self.conn.execute(
            f"INSERT INTO mortgageos.escrow_legs ({', '.join(cols)}) VALUES ({', '.join('%s' for _ in cols)}) RETURNING id", vals
        ).fetchone()
        return int(r["id"])

    def leg_settled(self, leg_id: int, finish_tx_hash: str) -> None:
        self.conn.execute("UPDATE mortgageos.escrow_legs SET status='Settled', finish_tx_hash=%s, updated_at=now() WHERE id=%s",
                          (finish_tx_hash, leg_id))

    def leg_proof_verified(self, leg_id: int, ledger_index: int) -> None:
        self.conn.execute("UPDATE mortgageos.escrow_legs SET proof_ledger_index=%s, proof_verified_at=now(), updated_at=now() WHERE id=%s",
                          (ledger_index, leg_id))

    def settled_legs(self, loan_id: str) -> list[dict]:
        return self._all("SELECT * FROM mortgageos.escrow_legs WHERE loan_id=%s AND status='Settled' ORDER BY period, id", (loan_id,))

    def schedule_rows(self, loan_id: str) -> list[dict]:
        return self._all("SELECT * FROM mortgageos.payment_schedule WHERE loan_id=%s ORDER BY period", (loan_id,))

    def leg_failed(self, leg_id: int) -> None:
        self.conn.execute("UPDATE mortgageos.escrow_legs SET status='Failed', updated_at=now() WHERE id=%s", (leg_id,))

    def legs(self, loan_id: str, period: int) -> list[dict]:
        return self._all("SELECT * FROM mortgageos.escrow_legs WHERE loan_id=%s AND period=%s ORDER BY id", (loan_id, period))
