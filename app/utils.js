export async function checkResponse(resp) {
  if (!resp.ok)
    throw new Error(`HTTP Error Response: ${resp.status} ${resp.statusText}
      Error body: ${await resp.text()}`);
}
