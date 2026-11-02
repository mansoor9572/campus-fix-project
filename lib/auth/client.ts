export async function accountRequest(action: string, input: Record<string, unknown>) {
  const response = await fetch(`/api/account/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || "Unable to complete this request.")
  return body as { message: string }
}
