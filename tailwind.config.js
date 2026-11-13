/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./*/index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0a0a0a", 1: "#0d0d0d", 2: "#111111" },
        paper: "#e8e4dc",
        gold: "#c9a96e",
      },
      fontFamily: {
        serif: ['"DM Serif Display"', "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        naskh: ["Amiri", '"Noto Naskh Arabic"', "serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s ease both",
        "slide-up": "slide-up 0.7s ease 0.1s both",
        "slide-up-delay": "slide-up 0.7s ease 0.25s both",
        "slide-up-delay-2": "slide-up 0.7s ease 0.4s both",
      },
    },
  },
  plugins: [],
};
