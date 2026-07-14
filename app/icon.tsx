import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/app-icon";

export const size = {
  height: 512,
  width: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIcon size={size.width} />, size);
}
