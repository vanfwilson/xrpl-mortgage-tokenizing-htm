# Devnet run log

Latest full run of `npm run tokenize -- out/print/closing-package-stack.pdf --service` (paper → OCR → token → vault → loan → sweeps; every transaction tesSUCCESS).


Loan MORT-2026-88492X · documents sha256 `c5e3728582f7aea2b2a04cd631af38cafa4ba40b55512cc57f94d4a36d994d58`

## Accounts
- issuer: [r3ur7L4pTeK7ALSvtuPYoWXvUmZ97scXoY](https://devnet.xrpl.org/accounts/r3ur7L4pTeK7ALSvtuPYoWXvUmZ97scXoY)
- broker: [raHmGXmzzXUtcxZ6XHfEyfkzSPzto7EPg1](https://devnet.xrpl.org/accounts/raHmGXmzzXUtcxZ6XHfEyfkzSPzto7EPg1)
- servicer: [r3Qt78S9DsB8hSyFpU2JdofKTQaHa1V67w](https://devnet.xrpl.org/accounts/r3Qt78S9DsB8hSyFpU2JdofKTQaHa1V67w)
- homeowner: [rGEX9MLNNkZcrRviVYYfDZ9aswYaGwCndg](https://devnet.xrpl.org/accounts/rGEX9MLNNkZcrRviVYYfDZ9aswYaGwCndg)
- taxImpound: [rPf2udJqfhCc9YP7ZFHzf6CioAPbzDDnuz](https://devnet.xrpl.org/accounts/rPf2udJqfhCc9YP7ZFHzf6CioAPbzDDnuz)
- insuranceImpound: [rPVgcwDHSJVcTW2xZDuuaaAAMkAnZrn3NA](https://devnet.xrpl.org/accounts/rPVgcwDHSJVcTW2xZDuuaaAAMkAnZrn3NA)
- countyTreasurer: [rshw3vk3eBkJggvtLWzcwRZqZwnSQCYxH9](https://devnet.xrpl.org/accounts/rshw3vk3eBkJggvtLWzcwRZqZwnSQCYxH9)
- insuranceCarrier: [rNngEb7dRTHEFXGhjq4tNyhoP3CF7QFgXG](https://devnet.xrpl.org/accounts/rNngEb7dRTHEFXGhjq4tNyhoP3CF7QFgXG)
- investorA: [rGpdAekB61czroo4cKJdfyJmsJAo8PycVW](https://devnet.xrpl.org/accounts/rGpdAekB61czroo4cKJdfyJmsJAo8PycVW)
- investorB: [rJv7yryX3uCosje4geqPhHNFnWGaq7zVtT](https://devnet.xrpl.org/accounts/rJv7yryX3uCosje4geqPhHNFnWGaq7zVtT)
- kyc: [rNpt7UPQSCoZtCFcadtRSZ4t2vJdWg4mLh](https://devnet.xrpl.org/accounts/rNpt7UPQSCoZtCFcadtRSZ4t2vJdWg4mLh)

## Ledger objects
- domainId: `97D2201975FB860EFA07D81C3042C43C65F7429DBC37408FB827BD2A03816259`
- mptIssuanceId: `004CF682569EE765E2CFF129A4C26DD5411FAAB8ECE0D207`
- vaultId: `0BB3DA97A8FD2B88E91346EA03880DC765D6E4564421AC6527AC286D258E7BD0`
- vaultShareMptId: `000000017DE9B36CFC22A4922F43A5A7D93CA4A286DB1939`
- loanBrokerId: `89E7708D1037FD533B917D6A8E7CF2AC6BF3470D7EED3F252A8B4C33F59580B8`
- loanId: `AE52AD5F09181A93C3AB6328D5F329267D445B0C49C0696E0EE439B25B6D8256`
- taxEscrowTx: `1BF91F725702DC06D3E4B5C1616D465DF7BDE8A1A04AABE6E7324944AC0A2F88`
- insuranceEscrowTx: `8FA5B54E139DAD59733BFBE1FF4DED07FBB88E96D472715F847F2FDAE7A9ECD9`

## Transactions
| step | type | result | tx |
|---|---|---|---|
| credentials | PermissionedDomainSet | tesSUCCESS | [801F8B68950D…](https://devnet.xrpl.org/transactions/801F8B68950D32F02A9F8DB512A41010E2DCEAB746221CFA8D89DE7C694A444C) |
| mpt | MPTokenIssuanceCreate | tesSUCCESS | [1FF1577449B4…](https://devnet.xrpl.org/transactions/1FF1577449B4A6AF8AF7EBD1280B47F127F578A712E47AC221DCA83E356BEE68) |
| mpt | MPTokenAuthorize | tesSUCCESS | [913C01EDB81B…](https://devnet.xrpl.org/transactions/913C01EDB81BE82AF272EF7ED0BEF7D7049CE6BFFBC4227D7BD0D6FD76B776CA) |
| mpt | MPTokenAuthorize | tesSUCCESS | [A0F6F4BE2EA7…](https://devnet.xrpl.org/transactions/A0F6F4BE2EA7A9547362917761C4AE0D847E03B751F6A4D8229D6F13C1130D97) |
| mpt | MPTokenAuthorize | tesSUCCESS | [DBBD00099293…](https://devnet.xrpl.org/transactions/DBBD00099293771FC34A5552CBBF8B87E7712989D2129B3917F0FCFEF4BAA563) |
| mpt | MPTokenAuthorize | tesSUCCESS | [7ABA8CCABAA5…](https://devnet.xrpl.org/transactions/7ABA8CCABAA5E7BBAD56504C90A594E277F78AA919F60B8652A1C1DCB3311B39) |
| mpt | Payment | tesSUCCESS | [0C9E02965B75…](https://devnet.xrpl.org/transactions/0C9E02965B75A57D6CB3C0245574A5C41294BEBAEB1784D46805AA0BDB1E6D61) |
| mpt | Payment | tesSUCCESS | [59BA67B11E3A…](https://devnet.xrpl.org/transactions/59BA67B11E3AF0654E1FD3F7567E1D351B8A43D8C52DAC4DBB0FBF788A719EB6) |
| vault | VaultCreate | tesSUCCESS | [6B53D0AC61B2…](https://devnet.xrpl.org/transactions/6B53D0AC61B2A9D5C3872533A314C00AD9DA9589AE13AFAC6AE7AB1D62295B28) |
| vault | VaultDeposit | tesSUCCESS | [8DF7774C3714…](https://devnet.xrpl.org/transactions/8DF7774C3714DA0F18B7FD814418A0CCC5DBC4FA79496FFCBBA9CC6F318778AB) |
| vault | VaultDeposit | tesSUCCESS | [3432E55BEA96…](https://devnet.xrpl.org/transactions/3432E55BEA9697FA9FCFEE74AD1137D0DEBF430F750EC2901B7191245EB9C5EE) |
| lending | LoanBrokerSet | tesSUCCESS | [F04667EAEC65…](https://devnet.xrpl.org/transactions/F04667EAEC652CF02448ACDEF3ED915E5B9FD77FE23C6DF4CC057A7219E7FCD7) |
| lending | LoanBrokerCoverDeposit | tesSUCCESS | [F7E78C907D87…](https://devnet.xrpl.org/transactions/F7E78C907D87C048FE532EA8E6FE493B4E889CE0D5BD5C17D8E3F431024C605F) |
| lending | LoanSet | tesSUCCESS | [E316C97354B9…](https://devnet.xrpl.org/transactions/E316C97354B98F2E05AD0DEA6B9BDCF9F0ABA48856CE483EE0E153E4DFC80D9B) |
| servicing | Payment | tesSUCCESS | [46ADD0DDE1D7…](https://devnet.xrpl.org/transactions/46ADD0DDE1D794149B9304A3AA75E47774B733B550D8443D1CD9AD4EF04205A0) |
| servicing | LoanPay | tesSUCCESS | [B1A78ED900C2…](https://devnet.xrpl.org/transactions/B1A78ED900C23F9FD4915DCA57650886BB0E4F8DDAF7D6D289ECBAA444CBAA8B) |
| servicing | Payment | tesSUCCESS | [CA27B8AB7218…](https://devnet.xrpl.org/transactions/CA27B8AB7218C759DCC908AE948A813615017D007B9C9FEF4F368A6E94A7EDE3) |
| servicing | Payment | tesSUCCESS | [56020980A8F8…](https://devnet.xrpl.org/transactions/56020980A8F8426AE2BED820775186E287F1D52E863557B6E9A99366F7E3544E) |
| servicing | Payment | tesSUCCESS | [201EF042B1EA…](https://devnet.xrpl.org/transactions/201EF042B1EAC5CCE9F6117154FD829A32BDE4ED954723D1C9C2093BF47CD108) |
| servicing | LoanPay | tesSUCCESS | [027184DBC139…](https://devnet.xrpl.org/transactions/027184DBC139F2AF25AF13E3128E97C3259C0108D5C7F2C9804A1313017C6C8F) |
| servicing | Payment | tesSUCCESS | [3EA6ABDCEAD1…](https://devnet.xrpl.org/transactions/3EA6ABDCEAD1DECEE5A06EAF561E4D44C4B0EB0D67EBF6B1C6FBDFA79D3C2DBB) |
| servicing | Payment | tesSUCCESS | [6F314C542A40…](https://devnet.xrpl.org/transactions/6F314C542A40CF2FFD98F8499C490CF3F3E6358275ABAC350FD20F622F1391ED) |
| servicing | EscrowCreate | tesSUCCESS | [1BF91F725702…](https://devnet.xrpl.org/transactions/1BF91F725702DC06D3E4B5C1616D465DF7BDE8A1A04AABE6E7324944AC0A2F88) |
| servicing | EscrowCreate | tesSUCCESS | [8FA5B54E139D…](https://devnet.xrpl.org/transactions/8FA5B54E139DAD59733BFBE1FF4DED07FBB88E96D472715F847F2FDAE7A9ECD9) |
| servicing | LoanManage | tesSUCCESS | [581584017044…](https://devnet.xrpl.org/transactions/581584017044FCADC42DB372BC343F2ACD1020C17739B09CC33850EF60F1482B) |
| servicing | LoanManage | tesSUCCESS | [DCC95DA7A6A7…](https://devnet.xrpl.org/transactions/DCC95DA7A6A73327755E9166D7C828B8779E699FC96DFD0F248A3ABC37B78E04) |

## Notes
- tokenized from scan closing-package-stack.pdf
- provenance: {"loan.loan_id":"closing_disclosure","loan.principal_amount":"closing_disclosure","loan.annual_interest_rate":"closing_disclosure","loan.term_months":"closing_disclosure","loan.first_payment_date":"closing_disclosure","loan.maturity_date":"closing_disclosure","loan.monthly_principal_and_interest":"closing_disclosure","servicing.insurance_detail.fha_mip":"closing_disclosure","servicing.property_tax_impound":"closing_disclosure","servicing.insurance_detail.hazard_homeowners":"closing_disclosure","servicing.monthly_total_sweep":"closing_disclosure","closing.closing_costs":"closing_disclosure","closing.cash_to_close":"closing_disclosure","closing.closing_date":"closing_disclosure","seller.name":"closing_disclosure","lender.name":"deed_of_trust","note_terms.payment_due_day_of_month":"note","note_terms.grace_period_days":"note","note_terms.late_charge_percent_of_pi":"note","borrower.name":"deed_of_trust","security_instrument.recording_number":"deed_of_trust","security_instrument.recording_date":"deed_of_trust","property.legal_description":"deed_of_trust","property.apn":"deed_of_trust","property.address":"deed_of_trust","vesting_deed.recording_number":"warranty_deed","vesting_deed.recording_date":"warranty_deed","property.contract_sales_price":"closing_disclosure","servicing.insurance_impound":"derived","closing.date_issued":"closing_disclosure"}
