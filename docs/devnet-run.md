# Devnet run log

Latest full run of `npm run tokenize -- out/print/closing-package-stack.pdf --service` on the 23-page signed package (paper → OCR → token → vault → loan → sweeps; every transaction tesSUCCESS).


Loan MORT-2026-88492X · documents sha256 `30d6566d91f8ad14f798f09ad897d5280e364f5208232effa875eec36e816e18`

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
- domainId: `45B12560DE0FB7437989DC9EE1422C2264300E589E93FB0249223F1B07D68597`
- mptIssuanceId: `004CF687569EE765E2CFF129A4C26DD5411FAAB8ECE0D207`
- vaultId: `8F5D11A8942A82ABF6A57B9462CE4C71808C3B23A8F4E3942E11FC4A4A5D3F85`
- vaultShareMptId: `0000000120A434200BA6D7EB043A2E64E26CB6A98975276E`
- loanBrokerId: `C35DF4863BCCB86B0255F85C2C0F463BF02D80631765C30AA720A0DC6A51DBF0`
- loanId: `D5E8FA40042E3072B8ED528AA85ACAD2BADA531850D2CE8C51820DBC5C926F11`
- taxEscrowTx: `A97B2B2A1352F48B1360501875BF71E056ED70720CDFAAD6F607493B04B67BB6`
- insuranceEscrowTx: `8E11E3121B4A2BEB118175921FCB6E510E0DB1CA1ADD501C84D7C311FE254F64`

## Transactions
| step | type | result | tx |
|---|---|---|---|
| credentials | PermissionedDomainSet | tesSUCCESS | [9B3936C56074…](https://devnet.xrpl.org/transactions/9B3936C56074A0FB13F3DB00009F199D1249C6AD89A8FD72B8CB6B896150B79F) |
| mpt | MPTokenIssuanceCreate | tesSUCCESS | [C522E0227EBA…](https://devnet.xrpl.org/transactions/C522E0227EBA5D2595AF70288EC8DC9342E58BBC84EED6B43B3C27A3598EADD4) |
| mpt | MPTokenAuthorize | tesSUCCESS | [7CE6E34274E6…](https://devnet.xrpl.org/transactions/7CE6E34274E63133EAA0CCAD682ADFE1962CEF863CA65EEC21BB66735FD0011C) |
| mpt | MPTokenAuthorize | tesSUCCESS | [868A3AB9C829…](https://devnet.xrpl.org/transactions/868A3AB9C8299C6B8A76D207241BC72A82897DD1BE39D7E39A93F876A0043866) |
| mpt | MPTokenAuthorize | tesSUCCESS | [2255ACF2127E…](https://devnet.xrpl.org/transactions/2255ACF2127EF2CA61F4E34792F7895B5EE26F76D76F19B34DC3DFD11F1DB933) |
| mpt | MPTokenAuthorize | tesSUCCESS | [1C267B836093…](https://devnet.xrpl.org/transactions/1C267B8360932137248F84C0DCE104CEC8135EA7AB53E0A99FC05AE43A187C1B) |
| mpt | Payment | tesSUCCESS | [70605C17860B…](https://devnet.xrpl.org/transactions/70605C17860B8C608398F204DF702791F1726D29263B9AA43E9C7411C8C481DA) |
| mpt | Payment | tesSUCCESS | [CD47BD664928…](https://devnet.xrpl.org/transactions/CD47BD6649285B1FC144DF8E558BB4C9A831F5BADBC17CD15C196417EA614C97) |
| vault | VaultCreate | tesSUCCESS | [8AEEA4FB81E4…](https://devnet.xrpl.org/transactions/8AEEA4FB81E43523FF5B200B1C8396D64DC586990DA76C8C366627A1EC00CC4E) |
| vault | VaultDeposit | tesSUCCESS | [D1C586DA42BF…](https://devnet.xrpl.org/transactions/D1C586DA42BFA3A6744906B0FDD6C3D09CA29DEA2377CB996F691230A852EDF0) |
| vault | VaultDeposit | tesSUCCESS | [F898DD510999…](https://devnet.xrpl.org/transactions/F898DD510999554CD7A89A3778C04507D31AAD9638C8CBEE441EC711C580D2C3) |
| lending | LoanBrokerSet | tesSUCCESS | [AA4402DE07CB…](https://devnet.xrpl.org/transactions/AA4402DE07CBFDD6DA37C81CFD00A06834520F910DA8E338A5DDDE2B80FB4652) |
| lending | LoanBrokerCoverDeposit | tesSUCCESS | [BBF1B2BBB6A0…](https://devnet.xrpl.org/transactions/BBF1B2BBB6A00BC9CC6AB50B42D26F70B1B9DD2D54C6DC984B3BEFA9BCE1B0F7) |
| lending | LoanSet | tesSUCCESS | [78926DD6BC74…](https://devnet.xrpl.org/transactions/78926DD6BC74CC34742C0240F0DBBF2EDE0C515569CFF02A9E5EC39444448535) |
| servicing | Payment | tesSUCCESS | [3E490E9F048B…](https://devnet.xrpl.org/transactions/3E490E9F048B5B11FE6C95B3E684FB4DA1A6AFBFF9BE49A34D060955D6E31430) |
| servicing | LoanPay | tesSUCCESS | [58E8B37CCD53…](https://devnet.xrpl.org/transactions/58E8B37CCD53B8679957C9FCAF39A33B9A3D8C17B16F7DE45F60B3D1249AEA5F) |
| servicing | Payment | tesSUCCESS | [7027E2CB3826…](https://devnet.xrpl.org/transactions/7027E2CB38265712B627322BC1D3B1E307C83C5819B7B57DBF37B12A2582B1AA) |
| servicing | Payment | tesSUCCESS | [FEB07304B3FA…](https://devnet.xrpl.org/transactions/FEB07304B3FAB5BCEE669F3695B1FC41503BE8C1671C33A7905056C3168AAFB2) |
| servicing | Payment | tesSUCCESS | [BE9AF303024D…](https://devnet.xrpl.org/transactions/BE9AF303024DF832AAB879B84B976C859BA4E71BFEB7C06AF55A05782AE51418) |
| servicing | LoanPay | tesSUCCESS | [9FDB22115466…](https://devnet.xrpl.org/transactions/9FDB2211546681B9FF1045B065EE1732DE83C056D441062CE5C7145CD280C650) |
| servicing | Payment | tesSUCCESS | [0098B4C554A2…](https://devnet.xrpl.org/transactions/0098B4C554A2185AE459B93643E86F2D45E2257056187FB61C75A1682B3D8757) |
| servicing | Payment | tesSUCCESS | [1C8C4F00FD57…](https://devnet.xrpl.org/transactions/1C8C4F00FD5704D4BAC23CDC77B72BA4EEE0B422E986886404A1453F1428FA47) |
| servicing | EscrowCreate | tesSUCCESS | [A97B2B2A1352…](https://devnet.xrpl.org/transactions/A97B2B2A1352F48B1360501875BF71E056ED70720CDFAAD6F607493B04B67BB6) |
| servicing | EscrowCreate | tesSUCCESS | [8E11E3121B4A…](https://devnet.xrpl.org/transactions/8E11E3121B4A2BEB118175921FCB6E510E0DB1CA1ADD501C84D7C311FE254F64) |
| servicing | LoanManage | tesSUCCESS | [14A445A39879…](https://devnet.xrpl.org/transactions/14A445A39879CE876BDF2B26F386E25E6D5A7B0CCA3516912787B4B6B56A3685) |
| servicing | LoanManage | tesSUCCESS | [C2E231A515E8…](https://devnet.xrpl.org/transactions/C2E231A515E8D5BCFFA0D990C3139C619DAEF1340093678375191EAA7E3C318B) |

## Notes
- tokenized from scan closing-package-stack.pdf
- provenance: {"loan.loan_id":"closing_disclosure","loan.principal_amount":"closing_disclosure","loan.annual_interest_rate":"closing_disclosure","loan.term_months":"closing_disclosure","loan.first_payment_date":"closing_disclosure","loan.maturity_date":"closing_disclosure","loan.monthly_principal_and_interest":"closing_disclosure","servicing.insurance_detail.fha_mip":"closing_disclosure","servicing.property_tax_impound":"closing_disclosure","servicing.insurance_detail.hazard_homeowners":"closing_disclosure","servicing.monthly_total_sweep":"closing_disclosure","closing.closing_costs":"closing_disclosure","closing.cash_to_close":"closing_disclosure","closing.closing_date":"closing_disclosure","seller.name":"closing_disclosure","lender.name":"deed_of_trust","note_terms.payment_due_day_of_month":"note","note_terms.grace_period_days":"note","note_terms.late_charge_percent_of_pi":"note","borrower.name":"deed_of_trust","security_instrument.recording_number":"deed_of_trust","security_instrument.recording_date":"deed_of_trust","property.legal_description":"deed_of_trust","property.apn":"deed_of_trust","property.address":"deed_of_trust","vesting_deed.recording_number":"warranty_deed","vesting_deed.recording_date":"warranty_deed","property.contract_sales_price":"closing_disclosure","servicing.insurance_impound":"derived","closing.date_issued":"closing_disclosure"}
