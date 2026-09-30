/**
 * Bundled fallback menu (same data as backend MenuSeeder, same order/ids).
 * Used when the API is unreachable; the API is the source of truth otherwise.
 */

export type DishImageKey =
  | 'momos'
  | 'raita'
  | 'boondi-raita'
  | 'vegetable-raita'
  | 'kadhi'
  | 'matar-paneer'
  | 'mix-paratha'
  | 'pyaz-paratha'
  | 'paneer-pakoda'
  | 'mix-pakoda'
  | 'alu-matar'
  | 'alu-shimla-mirch'
  | 'alu-gobhi'
  | 'gobhi-masala'
  | 'alu-zeera'
  | 'sev-bhaji'
  | 'veg-thali'
  | 'daal-chawal'
  | 'dal-fry'
  | 'dal-tadka'
  | 'chana-masala'
  | 'rajma'
  | 'chole'
  | 'hakka-noodles'
  | 'shezwan-noodles'
  | 'paneer-noodles'
  | 'garlic-noodles'
  | 'fried-momos'
  | 'kurkure-momos'
  | 'chilli-patato'
  | 'honey-chilli-potato'
  | 'manchuriyan-dry'
  | 'manchuriyan-gravy'
  | 'peri-peri-fries'
  | 'white-sauce-pasta'
  | 'red-sauce-pasta'
  | 'mix-sauce-pasta'
  | 'paneer-fried-rice'
  | 'shezwan-rice'
  | 'chilli-panner-dry'
  | 'chilli-panner-gravy'
  | 'jeera-rice'
  | 'steam-rice'
  | 'plane-maggie'
  | 'vegitable-maggie'
  | 'panner-maggie'
  | 'cheez-maggie'
  | 'tea'
  | 'banana-shake'
  | 'mango-shake'
  | 'oreo-shake'
  | 'vanilla-shake'
  | 'lemon-soda'
  | 'mint-mojito'
  | 'blue-lagoon'
  | 'shikanji'
  | 'lemon-water'
  | 'masala-chach'
  | 'lemon-tea'
  | 'black-tea'
  | 'green-tea'
  | 'ice-tea'
  | 'hot-coffee'
  | 'black-coffee'
  | 'mineral-water'
  | 'rice'
  | 'paneer'
  | 'chole-bhature'
  | 'chole-chawal'
  | 'rajma-chawal'
  | 'bread-pakoda'
  | 'cold-coffee'
  | 'french-fries'
  | 'kitkat-shake'
  | 'sweet-lassi'
  | 'mix-veg'
  | 'maggie'
  | 'aallo-paratha'
  | 'aallo-pyaz'
  | 'butter-roti'
  | 'gobhi-paratha'
  | 'paneer-paratha'
  | 'plain-paratha'
  | 'plain-roti'
  | 'puri-bhazi'
  | 'paneer-bhurji'
  | 'paneer-butter-masala'
  | 'paneer-do-pyaza'
  | 'dahi'
  | 'dal-makhni'
  | 'fried-rice'
  | 'kadhai-paneer'
  | 'kadhi-chawal'
  | 'special-veg-thali'
  | 'veg-momos'
  | 'veg-noodles'
  | 'bread-cutlet';

export type MenuItem = {
  id: number;
  name: string;
  priceLabel: string;
  priceValue: number;
  /** Half portion price (0 = MRP/not for sale). */
  halfPrice: number;
  /** Middle portion price — only 3-tier dishes (e.g. Plain Dahi). */
  midPrice: number | null;
  /** Full portion price, null = single-price dish. */
  fullPrice: number | null;
  desc: string;
  image?: DishImageKey | null;
  bestseller?: boolean;
  /** Admin switch — false = "Not available today" (dish chiptegi nahi). */
  available: boolean;
};

export type MenuCategory = {
  key: string;
  label: string;
  tileImage?: DishImageKey | null;
  items: MenuItem[];
};

/**
 * Split a printed label ("₹210 / 320", "₹20 / 40 / 80", "₹150", "MRP")
 * into half/mid/full prices. Mirrors backend MenuSeeder::splitPrices.
 */
export function splitPrices(priceLabel: string): {
  half: number;
  mid: number | null;
  full: number | null;
} {
  const nums = priceLabel.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length >= 3) return { half: nums[0], mid: nums[1], full: nums[nums.length - 1] };
  if (nums.length === 2) return { half: nums[0], mid: null, full: nums[1] };
  if (nums.length === 1) return { half: nums[0], mid: null, full: null };
  return { half: 0, mid: null, full: null };
}

const dish = (
  id: number,
  name: string,
  priceLabel: string,
  priceValue: number,
  desc: string,
  image?: DishImageKey | null,
  bestseller?: boolean,
): MenuItem => {
  const { half, mid, full } = splitPrices(priceLabel);
  return {
    id,
    name,
    priceLabel,
    priceValue,
    halfPrice: half,
    midPrice: mid,
    fullPrice: full,
    desc,
    image: image ?? null,
    bestseller,
    available: true,
  };
};

export const MENU: MenuCategory[] = [
  {
    key: 'breakfast',
    label: 'Breakfast',
    tileImage: 'chole-bhature',
    items: [
      dish(1, 'Aloo Paratha', '₹40', 40, 'Tawa-fresh, served with butter, curd & pickle.', 'aallo-paratha'),
      dish(2, 'Aloo Pyaj Paratha', '₹50', 50, 'Stuffed with spiced potato & onion.', 'aallo-pyaz'),
      dish(3, 'Gobhi Paratha', '₹60', 60, 'Stuffed cauliflower paratha with white butter.', 'gobhi-paratha'),
      dish(4, 'Mix Paratha', '₹70', 70, 'Mixed veg stuffing, tandoor-finished.', 'mix-paratha'),
      dish(5, 'Paneer Paratha', '₹80', 80, 'Stuffed with spiced paneer.', 'paneer-paratha'),
      dish(6, 'Plain Paratha', '₹20', 20, 'Simple layered whole-wheat paratha.', 'plain-paratha'),
      dish(8, 'Plain Roti', '₹10', 10, 'Tandoor-fresh whole wheat roti.', 'plain-roti'),
      dish(9, 'Butter Roti', '₹15', 15, 'Tandoori roti brushed with butter.', 'butter-roti'),
      dish(10, 'Puri Bhaji (5 Pieces)', '₹70', 70, 'Fluffy puris with spiced aloo bhaji.', 'puri-bhazi'),
      dish(11, 'Chole Bhature', '₹80', 80, 'Delhi-style chole with fluffy bhature.', 'chole-bhature', true),
    ],
  },
  {
    key: 'snacks',
    label: 'Snacks',
    tileImage: 'bread-pakoda',
    items: [
      dish(20, 'Bread Pakoda', '₹20', 20, 'Stuffed bread fritters, chai-time favourite.', 'bread-pakoda'),
      dish(21, 'Paneer Pakoda (8 Pcs)', '₹150', 150, 'Crisp batter-fried paneer bites.', 'paneer-pakoda'),
      dish(22, 'Mix Pakoda (250 gm)', '₹100', 100, 'Assorted monsoon fritters.', 'mix-pakoda'),
      dish(106, 'Bread Cutlet (2 Pcs)', '₹50', 50, 'Crisp bread cutlets with chutney.', 'bread-cutlet'),
    ],
  },
  {
    key: 'thali',
    label: 'Thali',
    tileImage: 'special-veg-thali',
    items: [
      dish(25, 'Veg Thali', '₹80', 80, 'Sabji + Dal + Roti + Salad + Rice.', 'veg-thali'),
      dish(26, 'Special Thali', '₹120', 120, 'Paneer + Dal + 4 Roti + Raita + Rice + Salad.', 'special-veg-thali', true),
    ],
  },
  {
    key: 'maincourse',
    label: 'Main Course',
    tileImage: 'rajma-chawal',
    items: [
      dish(27, 'Rajma Chawal', '₹40 / 70', 40, 'Half / Full. Homestyle rajma over steamed rice.', 'rajma-chawal'),
      dish(28, 'Kadhi Chawal', '₹40 / 70', 40, 'Half / Full. Tangy kadhi with rice.', 'kadhi-chawal'),
      dish(29, 'Chole Chawal', '₹40 / 70', 40, 'Half / Full. Amritsari chole with rice.', 'chole-chawal'),
      dish(30, 'Dal Chawal', '₹40 / 70', 40, 'Half / Full. Comforting dal with rice.', 'daal-chawal'),
    ],
  },
  {
    key: 'paneer',
    label: 'Paneer Dishes',
    tileImage: 'kadhai-paneer',
    items: [
      dish(31, 'Mutter Paneer', '₹150 / 260', 150, 'Half / Full. Peas & paneer in homestyle gravy.', 'matar-paneer'),
      dish(32, 'Kadhai Paneer', '₹200 / 320', 200, 'Half / Full. Wok-tossed with capsicum & kadhai masala.', 'kadhai-paneer', true),
      dish(33, 'Paneer Butter Masala', '₹190 / 300', 190, 'Half / Full. Rich makhani gravy, best with naan.', 'paneer-butter-masala'),
      dish(34, 'Paneer Burji', '₹180 / 340', 180, 'Half / Full. Scrambled paneer with onion-tomato masala.', 'paneer-bhurji'),
      dish(35, 'Paneer Do Pyaza', '₹220 / 340', 220, 'Half / Full. Paneer tossed with double onions & masala.', 'paneer-do-pyaza', true),
    ],
  },
  {
    key: 'veg',
    label: 'Vegetables',
    tileImage: 'mix-veg',
    items: [
      dish(36, 'Mix Veg', '₹90 / 160', 90, 'Half / Full. Seasonal garden vegetables.', 'mix-veg'),
      dish(37, 'Aloo Matar', '₹70 / 120', 70, 'Half / Full. Potato & peas homestyle curry.', 'alu-matar'),
      dish(38, 'Aloo Shimla', '₹80 / 150', 80, 'Half / Full. Potato with crunchy capsicum.', 'alu-shimla-mirch'),
      dish(39, 'Aloo Gobhi', '₹80 / 150', 80, 'Half / Full. Classic potato-cauliflower sabji.', 'alu-gobhi'),
      dish(40, 'Gobhi Masala', '₹80 / 150', 80, 'Half / Full. Cauliflower in spiced masala.', 'gobhi-masala'),
      dish(41, 'Aloo Jeera', '₹70 / 120', 70, 'Half / Full. Tempered with roasted cumin.', 'alu-zeera'),
      dish(42, 'Shev Bhaji', '₹150', 150, 'Spicy Kolhapuri-style sev curry.', 'sev-bhaji'),
    ],
  },
  {
    key: 'dal',
    label: 'Dal / Rajma / Chole',
    tileImage: 'dal-makhni',
    items: [
      dish(43, 'Dal Fry', '₹70 / 130', 70, 'Half / Full. Ghee-garlic tempered arhar dal.', 'dal-fry'),
      dish(44, 'Dal Tadka', '₹70 / 130', 70, 'Half / Full. Smoky tadka dal.', 'dal-tadka'),
      dish(45, 'Dal Makhani', '₹100 / 180', 100, 'Half / Full. Slow-cooked black urad, butter & cream.', 'dal-makhni', true),
      dish(46, 'Rajma', '₹80 / 140', 80, 'Half / Full. Jammu-style red kidney beans.', 'rajma'),
      dish(47, 'Chole', '₹80 / 140', 80, 'Half / Full. Amritsari chickpea curry.', 'chole'),
      dish(48, 'Chana Masala', '₹80 / 140', 80, 'Half / Full. Dry-spiced kala chana.', 'chana-masala'),
      dish(49, 'Kadhi Pakoda', '₹60 / 100', 60, 'Half / Full. Besan kadhi with soft pakodas.', 'kadhi'),
    ],
  },
  {
    key: 'chinese',
    label: 'Chinese & Momos',
    tileImage: 'veg-momos',
    items: [
      dish(50, 'Veg Noodles', '₹40 / 70', 40, 'Half / Full. Street-style wok-tossed noodles.', 'veg-noodles'),
      dish(51, 'Hakka Noodles', '₹100', 100, 'Smoky hakka-style noodles.', 'hakka-noodles'),
      dish(52, 'Schezwan Noodles', '₹110', 110, 'Fiery schezwan sauce noodles.', 'shezwan-noodles'),
      dish(53, 'Paneer Noodles', '₹140', 140, 'Noodles tossed with paneer strips.', 'paneer-noodles'),
      dish(54, 'Garlic Noodles', '₹80', 80, 'Burnt-garlic noodles.', 'garlic-noodles'),
      dish(55, 'Veg Momos (8 Pcs)', '₹70', 70, 'Steamed, with spicy red chutney.', 'veg-momos', true),
      dish(56, 'Fried Momos (8 Pcs)', '₹100', 100, 'Golden crisp-fried momos.', 'fried-momos'),
      dish(57, 'Kurkure Momos (8 Pcs)', '₹140', 140, 'Crunchy kurkure-coated momos.', 'kurkure-momos'),
      dish(58, 'Tandoori Momos (8 Pcs)', '₹120', 120, 'Charred in clay tandoor, smoky & juicy.', 'veg-momos'),
      dish(59, 'Manchurian (Dry)', '₹170', 170, 'Crisp veg dumplings, dry tossed.', 'manchuriyan-dry'),
      dish(60, 'Manchurian (Gravy)', '₹140', 140, 'Veg dumplings in garlic-soy gravy.', 'manchuriyan-gravy'),
      dish(61, 'Chilli Potato', '₹140', 140, 'Crisp fingers in chilli-garlic glaze.', 'chilli-patato'),
      dish(62, 'Honey Chilli Potato', '₹180', 180, 'Sweet-heat honey chilli glaze.', 'honey-chilli-potato'),
      dish(63, 'French Fry', '₹120', 120, 'Golden salted fries.', 'french-fries'),
      dish(64, 'Peri Peri', '₹140', 140, 'Dusted with peri peri masala.', 'peri-peri-fries'),
      dish(65, 'White Sos Pasta', '₹200', 200, 'Creamy alfredo-style pasta.', 'white-sauce-pasta'),
      dish(66, 'Red Sos Pasta', '₹180', 180, 'Tangy tomato-basil pasta.', 'red-sauce-pasta'),
      dish(67, 'Mix Sos Pasta', '₹160', 160, 'Pink sauce, best of both.', 'mix-sauce-pasta'),
      dish(68, 'Chilli Paneer (Gravy)', '₹220', 220, 'Paneer cubes in spicy gravy.', 'chilli-panner-gravy'),
      dish(69, 'Chilli Paneer (Dry)', '₹180', 180, 'Dry-tossed starter style.', 'chilli-panner-dry'),
      dish(70, 'Veg Fried Rice', '₹130', 130, 'Smoky wok rice with crunchy veg.', 'fried-rice'),
      dish(71, 'Paneer Fried Rice', '₹150', 150, 'Fried rice with paneer cubes.', 'paneer-fried-rice', true),
      dish(72, 'Veg Schezwan Rice', '₹140', 140, 'Spicy schezwan fried rice.', 'shezwan-rice'),
      dish(73, 'Jeera Rice', '₹70 / 120', 70, 'Half / Full. Basmati tempered with ghee-roasted cumin.', 'jeera-rice'),
      dish(74, 'Steam Rice', '₹50 / 90', 50, 'Half / Full. Plain steamed basmati.', 'steam-rice'),
    ],
  },
  {
    key: 'raita',
    label: 'Raita & Dahi',
    tileImage: 'dahi',
    items: [
      dish(75, 'Vegetable Raita', '₹70 / 120', 70, 'Half / Full. Cucumber-onion raita.', 'vegetable-raita'),
      dish(76, 'Bundi Raita', '₹60 / 100', 60, 'Half / Full. Crisp boondi in curd.', 'boondi-raita'),
      dish(77, 'Plain Dahi (Curd)', '₹20 / 40 / 80', 20, 'Fresh set curd, three serving sizes.', 'dahi'),
    ],
  },
  {
    key: 'maggi',
    label: 'Maggi',
    tileImage: 'maggie',
    items: [
      dish(78, 'Plain Maggie', '₹50', 50, 'Classic masala maggi.', 'plane-maggie'),
      dish(79, 'Veg Maggie', '₹70', 70, 'Loaded with garden vegetables.', 'vegitable-maggie'),
      dish(80, 'Paneer Maggie', '₹90', 90, 'With soft paneer cubes.', 'panner-maggie'),
      dish(81, 'Cheese Maggie', '₹110', 110, 'Topped with molten cheese.', 'cheez-maggie'),
    ],
  },
  {
    key: 'beverages',
    label: 'Beverages',
    tileImage: 'cold-coffee',
    items: [
      dish(82, 'Tea', '₹20', 20, 'Kadak doodh chai.', 'tea'),
      dish(83, 'Masala Tea', '₹30', 30, 'Brewed with crushed spices.'),
      dish(84, 'Lemon Tea', '₹40', 40, 'Light & refreshing.', 'lemon-tea'),
      dish(85, 'Black Tea', '₹30', 30, 'No-milk brew.', 'black-tea'),
      dish(86, 'Green Tea', '₹40', 40, 'Light detox brew.', 'green-tea'),
      dish(87, 'Ice Tea', '₹70', 70, 'Chilled lemon ice tea.', 'ice-tea'),
      dish(88, 'Hot Coffee', '₹60', 60, 'Steaming filter-style coffee.', 'hot-coffee'),
      dish(89, 'Cold Coffee', '₹130', 130, 'Thick blended frappe.', 'cold-coffee'),
      dish(90, 'Black Coffee', '₹40', 40, 'Bold & bitter brew.', 'black-coffee'),
      dish(91, 'Banana Shake', '₹90', 90, 'Thick milk shake.', 'banana-shake'),
      dish(92, 'Mango Shake', '₹90', 90, 'Seasonal alphonso-style shake.', 'mango-shake'),
      dish(93, 'KitKat Shake', '₹120', 120, 'Chocolate wafer shake.', 'kitkat-shake'),
      dish(94, 'Orio Shake', '₹120', 120, 'Cookies & cream shake.', 'oreo-shake'),
      dish(95, 'Vanila Shake', '₹120', 120, 'Classic vanilla bean shake.', 'vanilla-shake'),
      dish(97, 'Fresh Lemon Soda', '₹70', 70, 'Sweet / salted / mixed.', 'lemon-soda'),
      dish(98, 'Mint Mojito', '₹110', 110, 'Virgin mint-lime cooler.', 'mint-mojito'),
      dish(99, 'Blue Lagoon', '₹100', 100, 'Electric-blue citrus cooler.', 'blue-lagoon'),
      dish(100, 'Shikanji', '₹60', 60, 'Old Delhi-style nimbu masala.', 'shikanji'),
      dish(101, 'Lemon Water', '₹50', 50, 'Simple nimbu pani.', 'lemon-water'),
      dish(102, 'Masala Chach', '₹40', 40, 'Spiced buttermilk.', 'masala-chach'),
      dish(103, 'Sweet Lassi', '₹80', 80, 'Thick curd lassi with malai.', 'sweet-lassi'),
    ],
  },
];

/** Bestseller carousel order (photos first, spread out) — offline fallback only.
 *  Online me home screen live menu se bestseller flag wale dishes leti hai,
 *  taaki admin ke rate/name change turant dikhe. */
const BESTSELLER_IDS = [26, 32, 55, 71, 45, 35, 11];

export const BESTSELLERS: MenuItem[] = BESTSELLER_IDS.map(
  (id) => MENU.flatMap((c) => c.items).find((i) => i.id === id)!,
).filter(Boolean);

const ALL_ITEMS = new Map<number, MenuItem>(
  MENU.flatMap((c) => c.items).map((i) => [i.id, i]),
);

/** Live API menu registry — cart/bill hamesha admin ke fresh rate pe bane,
 *  bundled fallback sirf offline me. Home screen fetch ke baad set karti hai. */
let LIVE_ITEMS: MenuItem[] | null = null;

export function setLiveMenu(cats: MenuCategory[]): void {
  LIVE_ITEMS = cats.flatMap((c) => c.items);
}

export function findItem(id: number): MenuItem | undefined {
  return LIVE_ITEMS?.find((i) => i.id === id) ?? ALL_ITEMS.get(id);
}

/**
 * Local photo override by dish id (SEEDER ids — live API data ke liye).
 * Backend image_key zyadatar sahi hai; sirf jaha null hai waha override:
 * 25 = Bread Cutlet, 84 = Masala Tea (chai photo closest hai).
 * Nayi dish add ho to id seeder se verify karke hi entry dalna!
 */
const IMAGE_OVERRIDES: Record<number, DishImageKey> = {
  25: 'bread-cutlet',
  84: 'tea',
};

/** Convert API payload (single source of truth — admin dashboard) into local menu shape. */
export function fromApi(
  cats: Array<{
    key: string;
    label: string;
    items: Array<{
      id: number;
      name: string;
      description: string | null;
      price_label: string;
      price_value: number;
      half_price?: number | null;
      mid_price?: number | null;
      full_price?: number | null;
      bestseller: boolean;
      is_available?: boolean | null;
      image_key?: string | null;
    }>;
  }>,
): MenuCategory[] {
  const tiles: Record<string, DishImageKey> = {
    breakfast: 'chole-bhature',
    snacks: 'bread-pakoda',
    thali: 'special-veg-thali',
    maincourse: 'rajma-chawal',
    paneer: 'kadhai-paneer',
    veg: 'mix-veg',
    dal: 'dal-makhni',
    chinese: 'veg-momos',
    raita: 'dahi',
    maggi: 'maggie',
    beverages: 'cold-coffee',
  };
  return cats.map((c) => ({
    key: c.key,
    label: c.label,
    tileImage: tiles[c.key] ?? null,
    items: c.items.map((i) => {
      const priceLabel = i.price_label;
      const parsed = splitPrices(priceLabel);
      return {
        id: i.id,
        name: i.name,
        priceLabel,
        priceValue: i.price_value,
        halfPrice: typeof i.half_price === 'number' ? i.half_price : parsed.half,
        midPrice: typeof i.mid_price === 'number' ? i.mid_price : parsed.mid,
        fullPrice: typeof i.full_price === 'number' ? i.full_price : parsed.full,
        desc: i.description ?? '',
        image: IMAGE_OVERRIDES[i.id] ?? (i.image_key as DishImageKey | null) ?? null,
        bestseller: i.bestseller,
        available: i.is_available ?? true,
      };
    }),
  }));
}
