/** Remove only known tracking parameters; preserve parameters that identify content. */
export function canonicalSource(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw Error("Sources require HTTPS");
  for (const key of [...url.searchParams.keys()])
    if (key === "msockid" || key === "fbclid" || key.startsWith("utm_"))
      url.searchParams.delete(key);
  url.hash = "";
  url.searchParams.sort();
  return url.toString();
}
