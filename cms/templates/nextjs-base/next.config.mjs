/** @type {import('next').NextConfig} */
export default {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};