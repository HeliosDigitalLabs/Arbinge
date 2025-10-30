// packages/core/gql.ts
export async function gqlFetch<T = any>(
  url: string,
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`gql ${r.status} ${r.statusText} :: ${txt.slice(0, 300)}`);
  }
  const p = await r.json();
  if (p.errors?.length) {
    throw new Error(`gql errors: ${JSON.stringify(p.errors).slice(0, 300)}`);
  }
  return p.data as T;
}
