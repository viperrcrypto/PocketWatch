"use client"

import { CreditCardLiabilityCard, MortgageLiabilityCard, StudentLoanLiabilityCard } from "@/components/finance/liability-card"

interface AccountInfo {
  id: string
  type: string
  mask?: string | null
  name: string
}

interface Liabilities {
  creditCards?: Array<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  mortgages?: Array<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  studentLoans?: Array<any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function AccountLiabilityDetails({
  account,
  liabilities,
}: {
  account: AccountInfo | undefined
  liabilities: Liabilities | undefined
}) {
  if (!account || !liabilities) return null

  const isCredit = account.type === "credit" || account.type === "business_credit"
  const isLoan = account.type === "loan"
  const isMortgage = account.type === "mortgage"
  if (!isCredit && !isLoan && !isMortgage) return null

  const ccMatch = isCredit ? liabilities.creditCards?.find((cc: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
    cc.mask === account.mask || cc.accountName === account.name
  ) : null
  const mtgMatch = isMortgage ? liabilities.mortgages?.find((m: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
    m.mask === account.mask || m.accountName === account.name
  ) : null
  const slMatch = isLoan ? liabilities.studentLoans?.find((sl: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
    sl.mask === account.mask || sl.accountName === account.name
  ) : null

  if (!ccMatch && !mtgMatch && !slMatch) return null

  return (
    <div>
      <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-3 block">
        Liability Details
      </span>
      {ccMatch && <CreditCardLiabilityCard data={ccMatch} />}
      {mtgMatch && <MortgageLiabilityCard data={mtgMatch} />}
      {slMatch && <StudentLoanLiabilityCard data={slMatch} />}
    </div>
  )
}
