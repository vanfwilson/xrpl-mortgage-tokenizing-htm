# Devnet run log

Latest full run of `npm run demo` (all transactions tesSUCCESS). Regenerate by running the demo and copying `out/latest.md` here.


Loan MORT-2026-88492X · documents sha256 `18f375defc32a4481ec8a86aa47997441a390846120cddf8a6a124d7ba6733b9`

## Accounts
- issuer: [r3ur7L4pTeK7ALSvtuPYoWXvUmZ97scXoY](https://devnet.xrpl.org/accounts/r3ur7L4pTeK7ALSvtuPYoWXvUmZ97scXoY)
- broker: [raHmGXmzzXUtcxZ6XHfEyfkzSPzto7EPg1](https://devnet.xrpl.org/accounts/raHmGXmzzXUtcxZ6XHfEyfkzSPzto7EPg1)
- originator: [rpaiuCJMfutu8yoY3U8othaNpJsSVpzre9](https://devnet.xrpl.org/accounts/rpaiuCJMfutu8yoY3U8othaNpJsSVpzre9)
- investorA: [rGpdAekB61czroo4cKJdfyJmsJAo8PycVW](https://devnet.xrpl.org/accounts/rGpdAekB61czroo4cKJdfyJmsJAo8PycVW)
- investorB: [rJv7yryX3uCosje4geqPhHNFnWGaq7zVtT](https://devnet.xrpl.org/accounts/rJv7yryX3uCosje4geqPhHNFnWGaq7zVtT)
- kyc: [rNpt7UPQSCoZtCFcadtRSZ4t2vJdWg4mLh](https://devnet.xrpl.org/accounts/rNpt7UPQSCoZtCFcadtRSZ4t2vJdWg4mLh)
- title: [rEZbrLhEJBoyFruhaGQTYrHSuXaiumtjLs](https://devnet.xrpl.org/accounts/rEZbrLhEJBoyFruhaGQTYrHSuXaiumtjLs)
- buyer: [rfpLQhpJYChR22gF5zdNU41yTdv7whZ7Wp](https://devnet.xrpl.org/accounts/rfpLQhpJYChR22gF5zdNU41yTdv7whZ7Wp)

## Ledger objects
- domainId: `E4B412D94479069135E983156F1103DE5D46C0E7ABB0A713A4CB259655248BBC`
- mptIssuanceId: `004CF669569EE765E2CFF129A4C26DD5411FAAB8ECE0D207`
- vaultId: `CD6D33C55BB809AFCB5BE677A67C868D5613CCF7ABD24CF996BD5709326F3491`
- vaultShareMptId: `00000001D8ACE7C17A1145533815C27457EDA0180818B530`
- loanBrokerId: `3B5A5A82FE85B820522EA65982B6815B07A83826190EACECBB7CB7C6364BDD35`
- loanId: `6584CED5E62D0D18175B43DBB7AFDDE862199D8F1CB3EF55C23163A66038D2E7`
- escrowSequence: `5043814`

## Transactions
| step | type | result | tx |
|---|---|---|---|
| credentials | PermissionedDomainSet | tesSUCCESS | [C620B55A17BE…](https://devnet.xrpl.org/transactions/C620B55A17BE9AAE8AEC31B2D1E3E1F289C254A41BD6A3DC4CE79D214925B85C) |
| mpt | MPTokenIssuanceCreate | tesSUCCESS | [8265808CD20A…](https://devnet.xrpl.org/transactions/8265808CD20A0894BE1E979F5107D7991E93450B26B61A9DD8B811B4F0B7C460) |
| mpt | MPTokenAuthorize | tesSUCCESS | [1254D1F1FD0F…](https://devnet.xrpl.org/transactions/1254D1F1FD0F527A23D08F3B51A305B962E9ED1353BBF0195DB674CF1B62E9E7) |
| mpt | MPTokenAuthorize | tesSUCCESS | [205DA4F2367C…](https://devnet.xrpl.org/transactions/205DA4F2367C92C90450215560E977D8C7041C2F9730B2DC89332A7E78211C83) |
| mpt | MPTokenAuthorize | tesSUCCESS | [2C5C8509784B…](https://devnet.xrpl.org/transactions/2C5C8509784BAFEA4466EB162A676B006C2F1867B9322FB38557705FE7B58E90) |
| mpt | MPTokenAuthorize | tesSUCCESS | [4FADEC214DD5…](https://devnet.xrpl.org/transactions/4FADEC214DD5107EDFE93BDF762C967C0629DB86CE5F4EBF93258D52A0FFFF61) |
| mpt | Payment | tesSUCCESS | [48359F09394E…](https://devnet.xrpl.org/transactions/48359F09394EB3F47239D579518C7D018BA26CEDA94C0A199B03364157D796F7) |
| mpt | Payment | tesSUCCESS | [5D825B9EBB22…](https://devnet.xrpl.org/transactions/5D825B9EBB22F04B5A81CA255DF1136E736271BB295601CAB42478C9EB1CE3C6) |
| vault | VaultCreate | tesSUCCESS | [1A8990DDB171…](https://devnet.xrpl.org/transactions/1A8990DDB171DAFCE0239CBEFF02ECB58FF5612E4D759125F33F9B890DCBEB4B) |
| vault | VaultDeposit | tesSUCCESS | [95F8E640369A…](https://devnet.xrpl.org/transactions/95F8E640369A404A2FC48C2E803DDC3FAB1F623C837CCB17581904E09B2F7A98) |
| vault | VaultDeposit | tesSUCCESS | [180725C3BA0A…](https://devnet.xrpl.org/transactions/180725C3BA0ADBB6A266C982FA6B521D7364820ED6849E86384703AC2E320EB1) |
| lending | LoanBrokerSet | tesSUCCESS | [191B1F36EAE0…](https://devnet.xrpl.org/transactions/191B1F36EAE029CC8B1DA7BC01F15546D64B084F807E5983B7D5BFF0B8CBA94E) |
| lending | LoanBrokerCoverDeposit | tesSUCCESS | [E25236843988…](https://devnet.xrpl.org/transactions/E25236843988814DA5F68546958B6E5FBE337C1611038BC296B7648EBF24897B) |
| lending | LoanSet | tesSUCCESS | [5391BBE04567…](https://devnet.xrpl.org/transactions/5391BBE045674CBC076B24E86397D41440E7D05AEF3103C5503891EF5B0CDB18) |
| escrow | EscrowCreate | tesSUCCESS | [9EDC8819A040…](https://devnet.xrpl.org/transactions/9EDC8819A0403C3430ED8E08E4EF9F077552BFC1D7661036B500A737AF6A13B4) |
| escrow | EscrowFinish | tesSUCCESS | [10771E0A867C…](https://devnet.xrpl.org/transactions/10771E0A867C8C9F96DF5063B409D7F3DFF16B174264416BC087B1A0BA332AE6) |
| servicing | LoanPay | tesSUCCESS | [A133953D5370…](https://devnet.xrpl.org/transactions/A133953D5370CF1638870485DA44D7839264D9882D7795366DB61550C6D8211A) |
| servicing | LoanPay | tesSUCCESS | [D2787CFA609E…](https://devnet.xrpl.org/transactions/D2787CFA609E99DFB82F8243CFD9C4CD436C90BA7FFAFFEF5B657B4720A5CBEC) |
| servicing | LoanManage | tesSUCCESS | [6686AE096642…](https://devnet.xrpl.org/transactions/6686AE096642354FE55AD5C22E8CAEA15F2C06BB9573936D16D3975D241AFA9F) |
| servicing | LoanManage | tesSUCCESS | [85BAC69F7869…](https://devnet.xrpl.org/transactions/85BAC69F786940F13A3190DFE0765D36DEB2DC6C8F8C71E9EC27C78937C16F90) |

## Notes
- Default path not exercised; run `npm run demo:full` to wait out the grace period and default the loan.
