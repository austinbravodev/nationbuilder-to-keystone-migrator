import fetch from "node-fetch";

import { checkResponse } from "./utils.js";

export default async function createItems(type, data) {
  const batchSize = type === "Post" ? 10 : 30;
  const reqs = [];

  for (let i = 0; i < data.length; i += batchSize) {
    const itemData = JSON.stringify(data.slice(i, i + batchSize));

    reqs.push(
      fetch(process.env.CMS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body:
          type === "Post"
            ? `{"query":"mutation Mutation($data: [PostCreateInput!]!) { createPosts(data: $data) { id }}","variables":{"data":${itemData}}}`
            : `{"query":"mutation Create${type}s($data: [${type}CreateInput!]!) { create${type}s(data: $data) { id }}","variables":{"data":${itemData}}}`,
      }),
    );
  }

  for (const resp of await Promise.all(reqs)) {
    await checkResponse(resp);

    for (const err of (await resp.json()).errors || []) {
      const errPrisma = err.extensions?.prisma;
      const errIndex = err.path?.[1];
      const errSuffix = `: data[${errIndex}] = ${JSON.stringify(
        data[errIndex],
      )}`;

      !(
        errPrisma?.code === "P2002" &&
        errPrisma.meta?.target?.includes?.("slug")
      )
        ? console.error(`${type} creation error${errSuffix}`)
        : console.log(`${type} not created (duplicate slug)${errSuffix}`);
    }
  }
}
