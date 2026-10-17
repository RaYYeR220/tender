export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tender-checkout.vercel.app").replace(/\/$/, "");
export const REPO_URL = "https://github.com/RaYYeR220/tender";
export const REGISTRY_EDIT_URL = `${REPO_URL}/edit/main/registry/merchants.json`;
export const REGISTRY_FILE_URL = `${REPO_URL}/blob/main/registry/merchants.json`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const PAYBOX_PLUGINS_URL = "https://app.paybox.sh/plugins";
export const PAYBOX_URL = "https://paybox.sh";
export const MOONPAY_COMMERCE_URL = "https://moonpay.hel.io";
export const X402_URL = "https://x402.org";

export const EXAMPLES = {
  ready: { label: "Flat white (agent-ready)", link: "https://moonpay.hel.io/pay/6ad323565c71e316b383ea8a" },
  fields: { label: "Signed print (needs email)", link: "https://moonpay.hel.io/pay/6ad323588eb58f1259a0ae16" },
} as const;

/** The real mainnet MoonPay Commerce payment used as the public receipt example. */
export const RECEIPT_EXAMPLE = {
  tx: "euuEheoCaV2PiM2GKh3qTtfT1qokfn1NspddY6m6QhmmNsPi2J9itj12EXyXqCxtebgxLxPyUeqXyMs5dHwgC9y",
  payer: "6UphUVdkevZD59y4XX5yJ4gd2kWDLHWDXuY7weYTov3",
};
export const RECEIPT_EXAMPLE_PATH = `/r/solana/${RECEIPT_EXAMPLE.tx}?payer=${RECEIPT_EXAMPLE.payer}`;

/** A real purchase made by an agent through PayBox with Tender (Tender Coffee, 17 Oct 2026). */
export const PAYBOX_PURCHASE_PATH =
  "/r/solana/3d4KqBCBXb8aWiwJRakGDuiX47VT7eFWcLB1HkTi6U94Qka4P6cvD2zN99ZCKspQxkFG45eDfRRdTBFdWMjNrFL9?payer=7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts&link=6ad323565c71e316b383ea8a";

export const hosted = (id: string) => `https://moonpay.hel.io/pay/${id}`;
export const checkHref = (link: string) => `/check?link=${encodeURIComponent(link)}`;
