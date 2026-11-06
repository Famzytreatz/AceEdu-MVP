export async function sendParentSetupSms(
  { phone, parentName, schoolName, schoolSlug, setupCode },
  {
    apiKey = process.env.TERMII_API_KEY,
    senderId = process.env.TERMII_SENDER_ID,
    channel = process.env.TERMII_CHANNEL || "generic",
    appOrigin = process.env.APP_ORIGIN || "http://localhost:8443",
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (!apiKey || !senderId) {
    return { delivered: false, reason: "not_configured" }
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("SMS delivery is unavailable in this server runtime.")
  }

  const portalUrl = new URL(
    `/s/${encodeURIComponent(schoolSlug)}/portal`,
    appOrigin,
  ).toString()
  const message =
    `${schoolName}: Parent portal for ${parentName}. Sign in at ${portalUrl} ` +
    `with ${phone} and setup code ${setupCode}. This code expires in 24 hours; ` +
    "change your password after signing in."

  let response
  try {
    response = await fetchImpl("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        api_key: apiKey,
        to: phone.replace(/^\+/, ""),
        from: senderId,
        sms: message,
        type: "plain",
        channel,
      }),
    })
  } catch {
    throw new Error("The parent setup SMS could not be sent.")
  }

  if (!response.ok) {
    throw new Error("The parent setup SMS could not be sent.")
  }
  return { delivered: true }
}
