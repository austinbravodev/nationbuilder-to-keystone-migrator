import "dotenv/config";

import createItems from "./createItems.js";
import { fetchAllPosts } from "./fetchData.js";

const REGIONS = Object.fromEntries(
  process.env.REGIONS.split(",").map((region) => {
    const fmtRegion = region
      .trim()
      .replace("Québécois", "Quebec")
      .replace("Quebecois", "Quebec");

    return [fmtRegion.toLowerCase(), fmtRegion];
  }),
);

const TYPES = process.env.TYPES.split(",").map((type) =>
  type.trim().toLowerCase(),
);

const SHOWS = Object.fromEntries(
  process.env.SHOWS.split(",").map((show) => show.trim().split(/\s+(.*)/, 2)),
);

async function handlePosts() {
  const allPosts = [];

  const allCategories = {
    Show: {},
    Journalist: {},
    Region: {},
    Topic: {},
  };

  function handleCategory(type, title) {
    const slug = title
      ?.trim()
      ?.toLowerCase()
      ?.replace(/[^\w ]+/g, "")
      ?.replace(/ +/g, "_");

    if (!(title in allCategories[type])) allCategories[type][title] = slug;

    return { slug: slug };
  }

  for (let blogID of process.env.BLOG_IDS.split(",")) {
    blogID = blogID.trim();
    const shows = [];

    if (blogID in SHOWS) shows.push(handleCategory("Show", SHOWS[blogID]));

    for (const [
      post,
      newPost,
      featImgProm,
      journoTitleProm,
    ] of await fetchAllPosts(blogID)) {
      const postCategories = {
        shows: shows,
        journalists: journoTitleProm
          ? [handleCategory("Journalist", await journoTitleProm)]
          : [],
        regions: [],
        topics: [],
      };

      for (const tag of post.tags || []) {
        const tagLower = tag.toLowerCase();

        if (!tagLower.startsWith("layout ")) {
          if (tagLower in REGIONS) {
            postCategories.regions.push(
              handleCategory("Region", REGIONS[tagLower]),
            );
            continue;
          } else if (TYPES.includes(tagLower)) {
            newPost.type = tagLower.replace("news analysis", "analysis");
            continue;
          }

          postCategories.topics.push(handleCategory("Topic", tag));
        }
      }

      for (const type in postCategories) {
        if (postCategories[type].length)
          newPost[type] = { connect: postCategories[type] };
      }

      allPosts.push({ ...newPost, ...(await featImgProm) });
    }
  }

  for (const type in allCategories) {
    const data = [];
    const category = allCategories[type];

    for (const title in category) {
      data.push({ slug: category[title], title: title });
    }

    await createItems(type, data);
  }

  await createItems("Post", allPosts);
}

await handlePosts();
