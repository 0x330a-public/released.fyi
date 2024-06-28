import {Button, Frog} from 'frog'
import {devtools} from 'frog/dev'
import {serveStatic} from 'frog/serve-static'
import {Box, Heading, Image, Spacer, Text, Divider, vars, VStack} from './ui.js'
import * as console from "node:console";
import {JSX} from "hono/dist/types/jsx/base.js";

const HUB_URL = process.env.HUB_URL!!;

type State = {
  page: number
};

export const app = new Frog<{State: State}>({
  ui: {vars},
  imageAspectRatio: "1:1",
  origin: "released.fyi",
  imageOptions: {
    width: 512,
    height: 512
  },
  initialState: {
    page: 0
  },
  browserLocation: "/redir",
  // honoOptions: undefined,
  title: "released.fyi",
  hub: {
    apiUrl: HUB_URL
  },
  verify: "silent",
});

type AuthorInfo = {
  name: String,
  image: String,
};

type Item = {
  category: String,
  text: String
};

type ApiResponse = {
  title: String,
  latest: boolean,
  author: AuthorInfo | undefined,
  tag: String,
  notes: String | undefined,
  items: Item[],
  url: String,
};

app.frame('gh/:owner/:repo', async (c) => {

  const {buttonValue, inputText, status, deriveState, req} = c

  const state = deriveState(previous => {
    if (buttonValue === "next") previous.page++
    if (buttonValue === "prev") previous.page--
  })

  const {owner, repo} = req.param();
  const tag = req.query("tag") ?? "latest";

  const notFound = (
    <Box
      grow
      alignVertical="center"
      backgroundColor="background"
      padding="32"
    >
      <VStack gap="4">
        <Heading>😢</Heading>
        <Heading>Couldn't find the specified release on this repository</Heading>
        <Text>404: {owner} - {repo} @ {tag}</Text>
      </VStack>
    </Box>
  );

  if (owner === ":owner" && repo === ":repo") {
    return c.res({
      image: notFound,
    });
  }

  let fetchUrl = `https://api.released.fyi/${owner}/${repo}`;
  if (tag !== "latest") {
    fetchUrl += `?tag=${tag}`;
  }
  console.log("fetching", fetchUrl);
  const response = await fetch(fetchUrl);

  if (response.status == 404) {
    return c.res({
      image: notFound,
    });
  }

  console.log("received data");

  const apiResponse: ApiResponse = await response.json();

  const overview = <VStack gap="4">
    <Heading>{apiResponse.title}</Heading>
    <Text>released by {apiResponse.author?.name ?? "someone"}</Text>
    <Image width="32" height="32" borderRadius="32"
           src={apiResponse.author?.image ?? "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png"}/>
  </VStack>;

  const pages : Array<JSX.Element[]> = [];
  let building: JSX.Element[] = [];
  const toRender = (apiResponse.items.length > 0 && apiResponse.items[0].text === "") ?
    apiResponse.items.slice(1) : apiResponse.items;

  for(const item of toRender) {
    if (building.length >= 10) {
      pages.push(building);
      building = [];
    } else if (item.text !== "") {
      building.push(
        <Text style={"italic"} weight={item.category === "bold" || item.category === "italic" ? "900" : "100"}
              size={item.category === "bold" || item.category === "italic" ? "18" : "16"}>
          {item.text}
        </Text>
      );
    } else {
      building.push(
        <Spacer size={"8"}/>
      );
    }
  }
  if (building.length > 0) {
    pages.push(building);
  }

  const hasMorePages = state.page < pages.length - 1;
  const hasLessPages = state.page > 0;

  const redirectButton = <Button.Redirect location={apiResponse.url}>Read in browser</Button.Redirect>;

  const inlineIntents = [];
  if (hasLessPages) {
    inlineIntents.push(<Button value={"prev"}>⇦</Button>)
  }
  if (hasMorePages) {
    inlineIntents.push(<Button value={"next"}>⇨</Button> )
  }
  inlineIntents.push(redirectButton);

  const inlinePage =
  <VStack grow gap="4">
    {overview}
    <Spacer size={"4"}/>
    <Divider direction={"horizontal"}/>
    <VStack grow alignVertical={"center"} gap="8">
      {pages[state.page]}
    </VStack>
    <Text size="16" grow align={"center"}>Page: {state.page+1}/{pages.length}</Text>
  </VStack>;

  console.log("rendering page",state.page);

  return c.res({
    title: `Released: ${apiResponse.title}`,
    image: (
      <Box
        grow
        alignVertical="center"
        backgroundColor="background200"
        padding="48"
      >
        {inlinePage}
      </Box>
    ),
    intents:
      inlineIntents,
  })
})

app.use("/", c => c.redirect("https://github.com/0x330a-public/released.fyi"));

app.use('/*', serveStatic({root: './public'}))
devtools(app, {serveStatic})

if (typeof Bun !== 'undefined') {
  Bun.serve({
    fetch: app.fetch,
    port: 3000,
  })
  console.log('Server is running on port 3000')
}
