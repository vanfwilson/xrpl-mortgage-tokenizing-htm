import type { CanonicalLoan } from '../ingest/canonical.js';

/**
 * MISMO v3.4-ALIGNED SUBSET of the ULAD (URLA) dataset. This is the container
 * shape and element names MISMO uses for the top-level loan/property/borrower
 * data points, produced from the canonical record. It is NOT a schema-validated
 * MISMO 3.4 document (no xlink arcs, no full DEAL_SETS extension set). Label it
 * as such wherever it is consumed.
 */
const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const pct = (r: number) => (r * 100).toFixed(3);

export function toMismoSubsetXml(loan: CanonicalLoan): string {
  const p = loan.property;
  const l = loan.loan;
  const [first, ...rest] = loan.borrower.name.split(' ');
  const last = rest.pop() ?? '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" MISMOReferenceModelIdentifier="3.4.032420160128" xmlns:ULAD="http://www.datamodelextension.org/Schema/ULAD">
  <!-- MISMO 3.4-aligned subset generated from htm.canonical-loan/1; not schema-validated. Synthetic data. -->
  <DEAL_SETS><DEAL_SET><DEALS><DEAL>
    <COLLATERALS><COLLATERAL><SUBJECT_PROPERTY>
      <ADDRESS>
        <AddressLineText>${esc(p.address.street)}</AddressLineText>
        <CityName>${esc(p.address.city)}</CityName>
        <CountyName>${esc(p.address.county)}</CountyName>
        <PostalCode>${esc(p.address.zip)}</PostalCode>
        <StateCode>${esc(p.address.state)}</StateCode>
      </ADDRESS>
      <PROPERTY_DETAIL>
        <FinancedUnitCount>1</FinancedUnitCount>
        <PropertyEstimatedValueAmount>${p.appraised_value.toFixed(2)}</PropertyEstimatedValueAmount>
        <PropertyUsageType>PrimaryResidence</PropertyUsageType>
      </PROPERTY_DETAIL>
      <SALES_CONTRACTS><SALES_CONTRACT><SALES_CONTRACT_DETAIL>
        <SalesContractAmount>${p.contract_sales_price.toFixed(2)}</SalesContractAmount>
      </SALES_CONTRACT_DETAIL></SALES_CONTRACT></SALES_CONTRACTS>
      <PARSED_LEGAL_DESCRIPTIONS><PARSED_LEGAL_DESCRIPTION>
        <UnparsedLegalDescription>${esc(p.legal_description)}</UnparsedLegalDescription>
        <PARCEL_IDENTIFICATIONS><PARCEL_IDENTIFICATION>
          <ParcelIdentificationType>AssessorUnformattedIdentifier</ParcelIdentificationType>
          <ParcelIdentifier>${esc(p.apn)}</ParcelIdentifier>
        </PARCEL_IDENTIFICATION></PARCEL_IDENTIFICATIONS>
      </PARSED_LEGAL_DESCRIPTION></PARSED_LEGAL_DESCRIPTIONS>
    </SUBJECT_PROPERTY></COLLATERAL></COLLATERALS>
    <LOANS><LOAN LoanRoleType="SubjectLoan">
      <AMORTIZATION><AMORTIZATION_RULE>
        <AmortizationType>Fixed</AmortizationType>
        <LoanAmortizationPeriodCount>${l.term_months}</LoanAmortizationPeriodCount>
        <LoanAmortizationPeriodType>Month</LoanAmortizationPeriodType>
      </AMORTIZATION_RULE></AMORTIZATION>
      <GOVERNMENT_LOAN><GOVERNMENT_LOAN_DETAIL>
        <FHA_MI_PremiumUpfrontPercent>1.750</FHA_MI_PremiumUpfrontPercent>
        <AgencyCaseIdentifier>${esc(l.fha_case_number ?? '')}</AgencyCaseIdentifier>
      </GOVERNMENT_LOAN_DETAIL></GOVERNMENT_LOAN>
      <LOAN_DETAIL>
        <BalloonIndicator>false</BalloonIndicator>
        <PrepaymentPenaltyIndicator>false</PrepaymentPenaltyIndicator>
      </LOAN_DETAIL>
      <LOAN_IDENTIFIERS><LOAN_IDENTIFIER>
        <LoanIdentifier>${esc(l.loan_id)}</LoanIdentifier>
        <LoanIdentifierType>LenderLoan</LoanIdentifierType>
      </LOAN_IDENTIFIER></LOAN_IDENTIFIERS>
      <MATURITY><MATURITY_RULE>
        <LoanMaturityPeriodCount>${l.term_months}</LoanMaturityPeriodCount>
        <LoanMaturityPeriodType>Month</LoanMaturityPeriodType>
        <LoanMaturityDate>${l.maturity_date}</LoanMaturityDate>
      </MATURITY_RULE></MATURITY>
      <PAYMENT><PAYMENT_RULE>
        <InitialPrincipalAndInterestPaymentAmount>${l.monthly_principal_and_interest.toFixed(2)}</InitialPrincipalAndInterestPaymentAmount>
        <ScheduledFirstPaymentDate>${l.first_payment_date}</ScheduledFirstPaymentDate>
      </PAYMENT_RULE></PAYMENT>
      <TERMS_OF_LOAN>
        <BaseLoanAmount>${l.base_loan_amount.toFixed(2)}</BaseLoanAmount>
        <LoanPurposeType>Purchase</LoanPurposeType>
        <MortgageType>FHA</MortgageType>
        <NoteAmount>${l.principal_amount.toFixed(2)}</NoteAmount>
        <NoteRatePercent>${pct(l.annual_interest_rate)}</NoteRatePercent>
      </TERMS_OF_LOAN>
      <ULAD:LOAN_EXTENSION><ULAD:LTV_RATIO_PERCENT>${(p.ltv * 100).toFixed(3)}</ULAD:LTV_RATIO_PERCENT></ULAD:LOAN_EXTENSION>
    </LOAN></LOANS>
    <PARTIES>
      <PARTY><INDIVIDUAL><NAME><FirstName>${esc(first)}</FirstName><LastName>${esc(last)}</LastName></NAME></INDIVIDUAL>
        <ROLES><ROLE><BORROWER><BORROWER_DETAIL><BorrowerClassificationType>Primary</BorrowerClassificationType></BORROWER_DETAIL></BORROWER><ROLE_DETAIL><PartyRoleType>Borrower</PartyRoleType></ROLE_DETAIL></ROLE></ROLES></PARTY>
      <PARTY><LEGAL_ENTITY><LEGAL_ENTITY_DETAIL><FullName>${esc(loan.lender.name)}</FullName></LEGAL_ENTITY_DETAIL></LEGAL_ENTITY>
        <ROLES><ROLE><LICENSES><LICENSE><LICENSE_DETAIL><LicenseIdentifier>${esc(loan.lender.nmls_id)}</LicenseIdentifier><LicenseIssuingAuthorityName>NMLS</LicenseIssuingAuthorityName></LICENSE_DETAIL></LICENSE></LICENSES><ROLE_DETAIL><PartyRoleType>NotePayTo</PartyRoleType></ROLE_DETAIL></ROLE></ROLES></PARTY>
      <PARTY><LEGAL_ENTITY><LEGAL_ENTITY_DETAIL><FullName>${esc(loan.closing.settlement_agent)}</FullName></LEGAL_ENTITY_DETAIL></LEGAL_ENTITY>
        <ROLES><ROLE><ROLE_DETAIL><PartyRoleType>ClosingAgent</PartyRoleType></ROLE_DETAIL></ROLE></ROLES></PARTY>
    </PARTIES>
  </DEAL></DEALS></DEAL_SET></DEAL_SETS>
</MESSAGE>
`;
}
