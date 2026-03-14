import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "discord-js-bot",
  appVersion: process.env.APP_VERSION || "default",
});
