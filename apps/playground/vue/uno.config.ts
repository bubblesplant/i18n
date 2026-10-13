import presetAttributify from "@unocss/preset-attributify";
import presetWind4 from "@unocss/preset-wind4";
import { defineConfig } from "unocss";

export default defineConfig({
  shortcuts: [
    {
      "flex-center": "flex justify-center items-center",
    },
  ],
  presets: [presetWind4(), presetAttributify()],
});
