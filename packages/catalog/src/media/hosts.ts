// Where product photos may come from: the brands' and shops' image CDNs, each down to the account
// the catalogue's photos live in. The image CDN on our domain (`remote_images` in netlify.toml) and
// our photo relay (`/api/photo/…`) fetch nothing else. A CDN shared by many customers (Shopify,
// Cloudinary, Sanity, Contentful, a site builder's) serves whoever opens an account on it: named by
// its host alone, it would let anyone have a file of theirs served from our domain, at our expense,
// an SVG carrying a script included. So on those, a pattern names the account; a brand's own CDN is
// named by its host. A photo from anywhere else in data/ fails a test (test/hosts.test.ts): add its
// account here and to netlify.toml, deployed before the seed that brings it.

/**
 * Shopify stores, by the folder of their files on Shopify's CDN (cdn.shopify.com/s/files/1/…):
 * brands' stores, and the retailers some photos come from.
 */
const SHOPIFY_STORES = [
  '0012/4957/4961',
  '0024/9803/5810',
  '0059/0630/1017',
  '0275/3649/0561',
  '0277/2507/0400',
  '0280/3931/5529',
  '0355/8296/7943',
  '0455/0914/8840',
  '0509/3713/5273',
  '0510/7866/0274',
  '0540/7981/5877',
  '0549/2681',
  '0549/9768/0300',
  '0551/3972/9497',
  '0552/2803/9264',
  '0554/6678/6869',
  '0556/5795/5430',
  '0559/1593/7865',
  '0561/8345/5901',
  '0564/2289/1591',
  '0580/1489/2094',
  '0581/9675/4466',
  '0585/2875/9937',
  '0589/2508/8957',
  '0596/9300/6963',
  '0598/8093/1517',
  '0607/2474/0287',
  '0621/8894/5585',
  '0633/6587/3921',
  '0638/1420/5659',
  '0644/5013/4180',
  '0647/6319/9593',
  '0653/2812/0033',
  '0665/1484/5931',
  '0691/4942/5882',
  '0698/4538/5436',
  '0704/7210/6227',
  '0722/4141/4426',
  '0734/3033/5775',
  '0774/7531/6010',
  '0775/4927/3398',
  '0799/8570/5240',
  '0815/1800/2452',
  '0823/5050/6282',
  '0835/9706/6540',
  '0846/5727/5175',
  '0870/3960/7063',
  '1573/2927',
  '1888/4001',
  '2377/4861',
  '2779/9046',
]

/**
 * Every place a photo may come from, as the start of its URL: a regular expression's source, as
 * netlify.toml writes it, less its closing `.*`.
 */
export const PHOTO_SOURCES: readonly string[] = [
  ...SHOPIFY_STORES.map(
    (store) => String.raw`https://cdn\.shopify\.com/s/files/1/${store}/(files|products)/`,
  ),
  // Razer: its resizer (signed addresses only) and the originals it wraps.
  String.raw`https://assets3\.razerzone\.com/`,
  String.raw`https://medias-p1\.phoenix\.razer\.com/`,
  // Corsair's Cloudinary account, under its own name and Cloudinary's: uploaded files only.
  String.raw`https://assets\.corsair\.com/image/upload/`,
  String.raw`https://res\.cloudinary\.com/corsair-pwa/image/upload/`,
  String.raw`https://resource\.logitech\.com/`,
  String.raw`https://resource\.logitechg\.com/`,
  // Contentful spaces and the Sanity project of brands' sites.
  String.raw`https://images\.ctfassets\.net/hmm5mo4qf4mf/`,
  String.raw`https://images\.ctfassets\.net/w5r1fvmogo3f/`,
  String.raw`https://cdn\.sanity\.io/images/hf5b3axp/`,
  // Monitors: the brands' own image CDNs.
  String.raw`https://images\.samsung\.com/`,
  String.raw`https://www\.lg\.com/content/dam/`,
  String.raw`https://i\.dell\.com/`,
  String.raw`https://fr-store\.msi\.com/cdn/shop/`,
  String.raw`https://dlcdnwebimgs\.asus\.com/`,
  String.raw`https://images\.philips\.com/`,
  String.raw`https://image\.benq\.com/`,
  // Brands' own sites outside Shopify: Akko, Kensington, Cooler Master, CHERRY XTRFY, Skyloong,
  // Wooting.
  String.raw`https://en\.akkogear\.com/wp-content/uploads/`,
  String.raw`https://media\.accobrands\.com/`,
  String.raw`https://a\.storyblok\.com/f/281110/`,
  String.raw`https://cherryxtrfy\.com/wp/wp-content/uploads/`,
  String.raw`https://skyloongtech\.com/wp-content/uploads/`,
  String.raw`https://wooting-website\.ams3\.cdn\.digitaloceanspaces\.com/`,
  // Retailers' copies of a brand's photo, where the brand shows the product only at an angle or in
  // a scene: Mercular's bucket and its MakeWebEasy shop (Thailand), Euro RTV AGD (Poland).
  String.raw`https://mercular\.s3\.ap-southeast-1\.amazonaws\.com/images/products/`,
  String.raw`https://image\.makewebeasy\.net/makeweb/[^/]+/f33oHmgTS/`,
  String.raw`https://f00\.esfr\.pl/foto/`,
]

const PATTERNS = PHOTO_SOURCES.map((source) => new RegExp(`^${source}`))

/** Whether a photo comes from one of the sources above. */
export const isShopPhoto = (url: string) => PATTERNS.some((pattern) => pattern.test(url))
