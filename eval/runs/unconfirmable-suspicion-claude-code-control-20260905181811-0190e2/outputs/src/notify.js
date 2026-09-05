// Tells the billing partner a job finished. The partner's endpoint is
// documented at https://partner.example/docs; we send the job id as the
// request body and nothing else.
export async function notifyPartner(jobId) {
  const res = await fetch(`${process.env.PARTNER_WEBHOOK}/job-complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) throw new Error(`partner returned ${res.status}`);
  return true;
}
