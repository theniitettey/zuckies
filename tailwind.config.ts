//@ts-nocheck
import type { Config } from "tailwindcss";

export default {
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
		backgroundImage: {
			'gradient-radial-light': 'radial-gradient(125% 125% at 50% 10%, #ffffff 20%, #f0f0f0 100%)',
			'gradient-radial-dark': 'radial-gradient(125% 125% at 50% 10%, #000000 40%, #2b092b 100%)',
		  },
		fontFamily: {
			sans: "var(--font-lato)",
			nebula: "var(--font-nebula)",
		  },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
		display: ['landscape'], 
  	}
  },
  plugins: [],
} satisfies Config;
