import { JSDOM } from "jsdom";
import fetch from "node-fetch";

import { checkResponse } from "./utils.js";

const URL_BASE = `https://${process.env.NATION_SLUG}.nationbuilder.com`;

const journalistsCache = {};

async function fetchPosts(next, params = {}) {
  const url = new URL(URL_BASE + next);
  url.searchParams.append("access_token", process.env.API_KEY);
  for (const k in params) url.searchParams.append(k, params[k]);

  const resp = await fetch(url);
  await checkResponse(resp);

  const data = await resp.json();

  const posts = data.results
    .filter((post) => ["published", "unlisted"].includes(post.status))
    .map((post) => {
      const newPost = {
        title: post.headline,
        redirectURL: process.env.ARCHIVES_URL + post.slug,
        status: post.status,
      };

      if (post.published_at)
        newPost.publishedAt = new Date(post.published_at).toISOString();

      const authorID = post.author_id;

      return [
        post,
        newPost,
        fetchImage(post.slug),
        authorID &&
          ((journalistsCache[authorID] &&
            Promise.resolve(journalistsCache[authorID])) ||
            fetchJournalist(authorID)),
      ];
    });

  if (data.next) {
    if (process.env.PAGINATE_POSTS === "true")
      posts.push(...(await fetchPosts(data.next)));
  }

  return posts;
}

export async function fetchAllPosts(blogID) {
  const posts = [];

  posts.push(
    ...(await fetchPosts(
      `/api/v1/sites/${process.env.SITE_SLUG}/pages/blogs/${blogID}/posts`,
      { limit: parseInt(process.env.POSTS_LIMIT) },
    )),
  );

  return posts;
}

export async function fetchJournalist(id) {
  const resp = await fetch(
    URL_BASE + "/api/v1/people/" + id + "?access_token=" + process.env.API_KEY,
  );
  await checkResponse(resp);

  let { first_name: firstName, last_name: lastName } = (await resp.json())
    .person;

  return (journalistsCache[id] =
    (firstName || "") + (firstName && lastName ? " " : "") + (lastName || ""));
}

export async function fetchImage(slug) {
  const resp = await fetch(process.env.ARCHIVES_URL + slug);
  await checkResponse(resp);

  const { head } = new JSDOM(await resp.text()).window.document;

  const featImgData = {};

  const featImgUrl = head.querySelector(
    'meta[name="featuredImageURL"',
  )?.content;

  if (featImgUrl) featImgData.featuredImageURL = featImgUrl;

  const featImgCaption = head.querySelector(
    'meta[name="featuredImageCaption"',
  )?.content;

  if (featImgCaption) featImgData.caption = featImgCaption;

  return featImgData;
}
