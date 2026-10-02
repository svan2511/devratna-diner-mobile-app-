import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Brand, Fonts } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { portionLabel, useCart, unitPrice, type CartLine, type Portion } from '@/context/CartContext';
import { BESTSELLERS, MENU, findItem, fromApi, setLiveMenu, type DishImageKey, type MenuItem } from '@/data/menu';
import { ScreenSkeleton, MenuListSkeleton } from '@/components/skeleton';
import { RazorpayCheckout, type RazorpayCheckoutData, type RazorpaySuccess } from '@/components/razorpay-checkout';
import { SHOP, deliveryChargeFor, distanceMetres, radiusLabel } from '@/lib/shop';
import { AppAlert, type AppAlertData } from '@/components/app-alert';
import { api, SessionExpiredError, type ApiBanner, type ApiHistoryOrder, type ApiOffer } from '@/lib/api';
import { formatTimer, pickBestOffer } from '@/lib/offers';
import {
  consumePendingOrdersTab,
  isOrderPush,
  ordersTabFromPushData,
} from '@/lib/notify-target';
import {
  addPushReceivedListener,
  addPushResponseListener,
  registerPushTokenDetailed,
  setupNotificationHandler,
} from '@/lib/push';
import * as Location from 'expo-location';

// App khuli ho tab bhi push banner + sound ke sath dikhe.
// (Expo Go me push nahi — waha ye no-op hai, polling se kaam chalega.)
setupNotificationHandler();

const FOOD_IMAGES: Record<DishImageKey, number> = {
  kadhi: require('@/assets/images/food/kadhi.jpg'),
  'matar-paneer': require('@/assets/images/food/matar-paneer.jpg'),
  'mix-paratha': require('@/assets/images/food/mix-paratha.jpg'),
  'pyaz-paratha': require('@/assets/images/food/pyaz-paratha.jpg'),
  'paneer-pakoda': require('@/assets/images/food/paneer-pakoda.jpg'),
  'mix-pakoda': require('@/assets/images/food/mix-pakoda.jpg'),
  'alu-matar': require('@/assets/images/food/alu-matar.jpg'),
  'alu-shimla-mirch': require('@/assets/images/food/alu-shimla-mirch.jpg'),
  'alu-gobhi': require('@/assets/images/food/alu-gobhi.jpg'),
  'gobhi-masala': require('@/assets/images/food/gobhi-masala.jpg'),
  'alu-zeera': require('@/assets/images/food/alu-zeera.jpg'),
  'sev-bhaji': require('@/assets/images/food/sev-bhaji.jpg'),
  'veg-thali': require('@/assets/images/food/veg-thali.jpg'),
  'daal-chawal': require('@/assets/images/food/daal-chawal.jpg'),
  'dal-fry': require('@/assets/images/food/dal-fry.jpg'),
  'dal-tadka': require('@/assets/images/food/dal-tadka.jpg'),
  'chana-masala': require('@/assets/images/food/chana-masala.jpg'),
  'rajma': require('@/assets/images/food/rajma.jpg'),
  'chole': require('@/assets/images/food/chole.jpg'),
  'hakka-noodles': require('@/assets/images/food/hakka-noodles.jpg'),
  'shezwan-noodles': require('@/assets/images/food/shezwan-noodles.jpg'),
  'paneer-noodles': require('@/assets/images/food/paneer-noodles.jpg'),
  'garlic-noodles': require('@/assets/images/food/garlic-noodles.jpg'),
  'fried-momos': require('@/assets/images/food/fried-momos.jpg'),
  'kurkure-momos': require('@/assets/images/food/kurkure-momos.jpg'),
  'chilli-patato': require('@/assets/images/food/chilli-patato.jpg'),
  'honey-chilli-potato': require('@/assets/images/food/honey-chilli-potato.jpg'),
  'manchuriyan-dry': require('@/assets/images/food/manchuriyan-dry.jpg'),
  'manchuriyan-gravy': require('@/assets/images/food/manchuriyan-gravy.jpg'),
  'peri-peri-fries': require('@/assets/images/food/peri-peri-fries.jpg'),
  'white-sauce-pasta': require('@/assets/images/food/white-sauce-pasta.jpg'),
  'red-sauce-pasta': require('@/assets/images/food/red-sauce-pasta.jpg'),
  'mix-sauce-pasta': require('@/assets/images/food/mix-sauce-pasta.jpg'),
  'paneer-fried-rice': require('@/assets/images/food/paneer-fried-rice.jpg'),
  'shezwan-rice': require('@/assets/images/food/shezwan-rice.jpg'),
  'chilli-panner-dry': require('@/assets/images/food/chilli-panner-dry.jpg'),
  'chilli-panner-gravy': require('@/assets/images/food/chilli-panner-gravy.jpg'),
  'jeera-rice': require('@/assets/images/food/jeera-rice.jpg'),
  'steam-rice': require('@/assets/images/food/steam-rice.jpg'),
  'plane-maggie': require('@/assets/images/food/plane-maggie.jpg'),
  'vegitable-maggie': require('@/assets/images/food/vegitable-maggie.jpg'),
  'panner-maggie': require('@/assets/images/food/panner-maggie.jpg'),
  'cheez-maggie': require('@/assets/images/food/cheez-maggie.jpg'),
  'tea': require('@/assets/images/food/tea.jpg'),
  'banana-shake': require('@/assets/images/food/banana-shake.jpg'),
  'mango-shake': require('@/assets/images/food/mango-shake.jpg'),
  'oreo-shake': require('@/assets/images/food/oreo-shake.jpg'),
  'vanilla-shake': require('@/assets/images/food/vanilla-shake.jpg'),
  'lemon-soda': require('@/assets/images/food/lemon-soda.jpg'),
  'mint-mojito': require('@/assets/images/food/mint-mojito.jpg'),
  'blue-lagoon': require('@/assets/images/food/blue-lagoon.jpg'),
  'shikanji': require('@/assets/images/food/shikanji.jpg'),
  'lemon-water': require('@/assets/images/food/lemon-water.jpg'),
  'masala-chach': require('@/assets/images/food/masala-chach.jpg'),
  'lemon-tea': require('@/assets/images/food/lemon-tea.jpg'),
  'black-tea': require('@/assets/images/food/black-tea.jpg'),
  'green-tea': require('@/assets/images/food/green-tea.jpg'),
  'ice-tea': require('@/assets/images/food/ice-tea.jpg'),
  'hot-coffee': require('@/assets/images/food/hot-coffee.jpg'),
  'black-coffee': require('@/assets/images/food/black-coffee.jpg'),
  'mineral-water': require('@/assets/images/food/mineral-water.jpg'),
  paneer: require('@/assets/images/food/paneer.jpg'),
  momos: require('@/assets/images/food/momos.jpg'),
  rice: require('@/assets/images/food/rice.jpg'),
  raita: require('@/assets/images/food/raita.jpg'),
  dahi: require('@/assets/images/food/dahi.jpg'),
  'chole-bhature': require('@/assets/images/food/chole-bhature.jpg'),
  'chole-chawal': require('@/assets/images/food/chole-chawal.jpg'),
  'rajma-chawal': require('@/assets/images/food/rajma-chawal.jpg'),
  'bread-pakoda': require('@/assets/images/food/bread-pakoda.jpg'),
  'bread-cutlet': require('@/assets/images/food/bread-cutlet.jpg'),
  'cold-coffee': require('@/assets/images/food/cold-coffee.jpg'),
  'french-fries': require('@/assets/images/food/french-fries.jpg'),
  'kitkat-shake': require('@/assets/images/food/kitkat-shake.jpg'),
  'sweet-lassi': require('@/assets/images/food/sweet-lassi.jpg'),
  'mix-veg': require('@/assets/images/food/mix-veg.jpg'),
  'maggie': require('@/assets/images/food/maggie.jpg'),
  'aallo-paratha': require('@/assets/images/food/aallo-paratha.jpg'),
  'aallo-pyaz': require('@/assets/images/food/aallo-pyaz.jpg'),
  'boondi-raita': require('@/assets/images/food/boondi-raita.jpg'),
  'butter-roti': require('@/assets/images/food/butter-roti.jpg'),
  'gobhi-paratha': require('@/assets/images/food/gobhi-paratha.jpg'),
  'paneer-paratha': require('@/assets/images/food/paneer-paratha.jpg'),
  'plain-paratha': require('@/assets/images/food/plain-paratha.jpg'),
  'plain-roti': require('@/assets/images/food/plain-roti.jpg'),
  'puri-bhazi': require('@/assets/images/food/puri-bhazi.jpg'),
  'paneer-bhurji': require('@/assets/images/food/paneer-bhurji.jpg'),
  'paneer-butter-masala': require('@/assets/images/food/paneer-butter-masala.jpg'),
  'paneer-do-pyaza': require('@/assets/images/food/paneer-do-pyaza.jpg'),
  'dal-makhni': require('@/assets/images/food/dal-makhni.jpg'),
  'fried-rice': require('@/assets/images/food/fried-rice.jpg'),
  'kadhai-paneer': require('@/assets/images/food/kadhai-paneer.jpg'),
  'kadhi-chawal': require('@/assets/images/food/kadhi-chawal.jpg'),
  'special-veg-thali': require('@/assets/images/food/special-veg-thali.jpg'),
  'veg-momos': require('@/assets/images/food/veg-momos.jpg'),
  'veg-noodles': require('@/assets/images/food/veg-noodles.jpg'),
  'vegetable-raita': require('@/assets/images/food/vegetable-raita.jpg'),
};

type Tab = 'home' | 'menu' | 'orders' | 'profile';

/**
 * Order frozen at the moment the user taps Proceed — the whole async
 * checkout (GPS wait + place order) runs on this, so mid-flight edits
 * to the cart/address can never corrupt the bill.
 */
type CheckoutSnap = {
  lines: CartLine[];
  total: number;
  deliveryFee: number;
  payable: number;
  address: string;
};

/** Native tab icons — iOS: SF Symbols, Android/Web: Material Symbols. */
const TABS = [
  { key: 'home', label: 'Home', icon: { ios: 'house.fill', android: 'home', web: 'home' } },
  { key: 'menu', label: 'Menu', icon: { ios: 'menucard', android: 'menu_book', web: 'menu_book' } },
  { key: 'orders', label: 'Orders', icon: { ios: 'receipt.fill', android: 'receipt_long', web: 'receipt_long' } },
  { key: 'profile', label: 'Profile', icon: { ios: 'person.fill', android: 'account_circle', web: 'account_circle' } },
] as const;

type BannerSlide = {
  key: string;
  title: string;
  text: string;
  pill: string;
  /** Menu category key ('all' samet) — null = no action. */
  target: string | null;
  /** Juda offer ki expiry (ISO) — timer chip ke liye. Null = koi timer nahi. */
  endsAt: string | null;
  bg: string;
  fg: string;
  sub: string;
  pillBg: string;
  pillFg: string;
};

/** Admin panel ke theme keys — Brand colors pe map (admin design bigaad nahi sakta). */
const BANNER_THEMES: Record<string, Pick<BannerSlide, 'bg' | 'fg' | 'sub' | 'pillBg' | 'pillFg'>> = {
  espresso: { bg: Brand.espresso, fg: Brand.cream, sub: Brand.gold, pillBg: Brand.gold, pillFg: '#3A2A00' },
  terracotta: { bg: Brand.terracotta, fg: '#FFFFFF', sub: '#FFE3D3', pillBg: 'rgba(255,255,255,0.25)', pillFg: '#FFFFFF' },
  gold: { bg: Brand.gold, fg: '#3A2A00', sub: '#5C4500', pillBg: Brand.espresso, pillFg: Brand.cream },
  cream: { bg: '#FFFFFF', fg: Brand.espresso, sub: Brand.stone, pillBg: Brand.terracotta, pillFg: '#FFFFFF' },
  forest: { bg: '#1E4D2B', fg: Brand.cream, sub: '#BCD5C2', pillBg: Brand.cream, pillFg: '#1E4D2B' },
};

/**
 * Brand slides — admin ne koi banner nahi banaya (ya API fail) to ye dikhenge.
 * Koi jhootha discount claim nahi, isliye design + bharosa dono safe.
 */
const FALLBACK_BANNERS: BannerSlide[] = [
  {
    key: 'brand-veg',
    title: '100% Pure Veg',
    text: 'Clement Town ka apna diner',
    pill: 'See menu',
    target: 'all',
    endsAt: null,
    ...BANNER_THEMES.espresso,
  },
  {
    key: 'brand-paratha',
    title: 'Tawa-fresh Parathas',
    text: 'Aloo pyaz • gobhi • paneer',
    pill: 'Breakfast',
    target: 'breakfast',
    endsAt: null,
    ...BANNER_THEMES.terracotta,
  },
  {
    key: 'brand-coolers',
    title: 'Shakes & Coolers',
    text: 'Cold coffee, lassi, mojito & more',
    pill: 'Sip it',
    target: 'beverages',
    endsAt: null,
    ...BANNER_THEMES.forest,
  },
];

const BANNER_GAP = 12;
// Card is slightly narrower so the next offer peeks in — slider feel.
const BANNER_W = Dimensions.get('window').width - 32 - 44;
// Cart sheet body cap — handle + paddings + fixed footer ke baad bachi jagah.
// (deterministic pixels, taaki list + bill kabhi button ko dhakka na de —
// button hamesha neeche fixed dikhega, upar wala hissa scroll hoga.)
const SHEET_BODY_MAX_H = Math.max(200, Dimensions.get('window').height * 0.85 - 230);
// GPS pin kitni der tak fresh — isse purana pin payment pe reuse nahi hoga.
// (Proceed ka pin seconds purana hota hai; 90s se purana = dobara Proceed.)
const POS_FRESH_MS = 90000;
// Keyboard khula ho to sheet us hisab se sikude — warna address box dab jata hai.
const WIN_H = Dimensions.get('window').height;

/** Green veg mark (everything here is pure veg). */
function VegMark() {
  return (
    <View style={styles.vegBox}>
      <View style={styles.vegDot} />
    </View>
  );
}

/**
 * Zomato-style portion popup — tapping ADD opens a small popup to
 * choose the portion. Each AddControl owns its own popup.
 */
function VariantPicker({
  item,
  visible,
  onClose,
  onTouched,
}: {
  item: MenuItem;
  visible: boolean;
  onClose: () => void;
  onTouched: (p: Portion) => void;
}) {
  const { qtyOf, add, remove } = useCart();
  // 3-tier dish (e.g. Plain Dahi) → Quarter / Half / Full, else Half / Full.
  const portions: Portion[] = item.midPrice != null ? ['quarter', 'half', 'full'] : ['half', 'full'];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.pickerTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.pickerSub}>Choose portion</Text>
          {portions.map((p) => {
            const price = unitPrice(item, p);
            const qty = qtyOf(item.id, p);
            return (
              <View key={p} style={styles.pickerRow}>
                <View>
                  <Text style={styles.pickerName}>{portionLabel(p)}</Text>
                  <Text style={styles.pickerPrice}>₹{price}</Text>
                </View>
                {qty === 0 ? (
                  <Pressable
                    style={styles.addBtn}
                    onPress={() => {
                      add(item, p);
                      onTouched(p);
                    }}>
                    <Text style={styles.addText}>ADD</Text>
                  </Pressable>
                ) : (
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => {
                        remove(item.id, p);
                        onTouched(p);
                      }}>
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepQty}>{qty}</Text>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => {
                        add(item, p);
                        onTouched(p);
                      }}>
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          <Pressable style={styles.pickerClose} onPress={onClose}>
            <Text style={styles.pickerCloseText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AddControl({ item, portion }: { item: MenuItem; portion?: Portion }) {
  const { qtyOf, add, remove } = useCart();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sel, setSel] = useState<Portion>('half');

  // Admin ne dish OFF ki — listing me kuch nahi (lal "Not Available now"
  // tag wahi dikhata hai); cart me stepper taaki line hata sake.
  if (!item.available && !portion) {
    return null;
  }

  // Single-price dish (or MRP) — simple ADD/stepper.
  if (item.fullPrice == null) {
    const qty = qtyOf(item.id, 'single');
    if (item.halfPrice <= 0) return <Text style={styles.mrp}>MRP</Text>;
    if (qty === 0) {
      return (
        <Pressable style={styles.addBtn} onPress={() => add(item, 'single')}>
          <Text style={styles.addText}>ADD</Text>
        </Pressable>
      );
    }
    return (
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => remove(item.id, 'single')}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepQty}>{qty}</Text>
        <Pressable style={styles.stepBtn} onPress={() => add(item, 'single')}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    );
  }

  // Cart sheet line — stepper for the same portion, no popup.
  if (portion) {
    const qty = qtyOf(item.id, portion);
    if (qty === 0) {
      return (
        <Pressable style={styles.addBtn} onPress={() => add(item, portion)}>
          <Text style={styles.addText}>ADD</Text>
        </Pressable>
      );
    }
    return (
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => remove(item.id, portion)}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepQty}>{qty}</Text>
        <Pressable style={styles.stepBtn} onPress={() => add(item, portion)}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    );
  }

  // Listing — shows ADD first, tapping it opens the portion popup (Zomato-style).
  const order: Portion[] = item.midPrice != null ? ['quarter', 'half', 'full'] : ['half', 'full'];
  const counts = Object.fromEntries(order.map((p) => [p, qtyOf(item.id, p)])) as Record<Portion, number>;
  const totalQty = order.reduce((s, p) => s + counts[p], 0);
  if (totalQty === 0) {
    return (
      <>
        <Pressable style={styles.addBtn} onPress={() => setPickerOpen(true)}>
          <Text style={styles.addText}>ADD</Text>
        </Pressable>
        <VariantPicker
          item={item}
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onTouched={setSel}
        />
      </>
    );
  }
  const active: Portion =
    sel !== 'single' && (counts[sel] ?? 0) > 0 ? sel : (order.find((p) => counts[p] > 0) ?? sel);
  const qty = counts[active] ?? 0;
  return (
    <>
      <Pressable onPress={() => setPickerOpen(true)} hitSlop={8}>
        <Text style={styles.selLabel}>{portionLabel(active)} ▾</Text>
      </Pressable>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => remove(item.id, active)}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepQty}>{qty}</Text>
        <Pressable style={styles.stepBtn} onPress={() => add(item, active)}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <VariantPicker
        item={item}
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onTouched={setSel}
      />
    </>
  );
}

/**
 * Zomato-style dish detail sheet — big photo, veg mark, name, price,
 * description + portion ADD. Opens on tapping any dish photo/name.
 */
function DishDetailModal({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  // Sheet buttons system nav ke neeche na dabe — bottom safe-area do.
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.detailBg} onPress={onClose}>
        <Pressable
          style={[styles.detailSheet, { paddingBottom: Math.max(28, bottom + 20) }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          {item ? (
            <>
              {item.image ? (
                <Image
                  source={FOOD_IMAGES[item.image]}
                  style={styles.detailImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ) : (
                <View style={[styles.detailImg, styles.bestMono]}>
                  <Text style={styles.bestMonoText}>{item.name.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.detailBody}>
                <VegMark />
                <Text style={styles.detailName}>{item.name}</Text>
                <Text style={styles.detailPrice}>{item.priceLabel}</Text>
                {!item.available && <Text style={styles.unavailTag}>Not Available now</Text>}
                {item.desc ? <Text style={styles.detailDesc}>{item.desc}</Text> : null}
                {item.bestseller ? <Text style={styles.detailBest}>★ Bestseller • 100% Pure Veg</Text> : (
                  <Text style={styles.detailBest}>100% Pure Veg • Made fresh</Text>
                )}
                <View style={styles.detailCta}>
                  <AddControl item={item} />
                  <Pressable style={styles.detailClose} onPress={onClose}>
                    <Text style={styles.detailCloseText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({ item, onDetail }: { item: MenuItem; onDetail?: (item: MenuItem) => void }) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowInfo} onPress={() => onDetail?.(item)}>
        <VegMark />
        <Text style={styles.rowName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.rowPrice}>{item.priceLabel}</Text>
        {!item.available && <Text style={styles.unavailTag}>Not Available now</Text>}
        {item.desc ? (
          <Text style={styles.rowDesc} numberOfLines={2}>
            {item.desc}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.rowAction}>
        <Pressable onPress={() => onDetail?.(item)}>
          {item.image ? (
            <Image source={FOOD_IMAGES[item.image]} style={styles.rowImg} contentFit="cover" cachePolicy="memory-disk" transition={200} />
          ) : (
            <View style={[styles.rowImg, styles.bestMono]}>
              <Text style={styles.bestMonoText}>{item.name.charAt(0)}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.rowAddWrap}>
          <AddControl item={item} />
        </View>
      </View>
    </View>
  );
}

function BestsellerCard({ item, onDetail }: { item: MenuItem; onDetail?: (item: MenuItem) => void }) {
  return (
    <Pressable style={styles.bestCard} onPress={() => onDetail?.(item)}>
      {item.image ? (
        <Image source={FOOD_IMAGES[item.image]} style={styles.bestImg} contentFit="cover" cachePolicy="memory-disk" transition={200} />
      ) : (
        <View style={[styles.bestImg, styles.bestMono]}>
          <Text style={styles.bestMonoText}>{item.name.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.bestBody}>
        <Text style={styles.bestName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.bestMeta}>
          <Text style={styles.bestRating}>★ 4.9</Text>
          <Text style={styles.bestPrice}>{item.priceLabel}</Text>
        </View>
        {!item.available && <Text style={styles.unavailTag}>Not Available now</Text>}
        <AddControl item={item} />
      </View>
    </Pressable>
  );
}

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  paid: { bg: '#E6F4EA', fg: '#1E7A34', label: 'Paid' },
  pending: { bg: '#FFF4DE', fg: '#8A5A00', label: 'Pending' },
  failed: { bg: '#FDECEA', fg: '#B3261E', label: 'Failed' },
};

const FULFILL_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  new: { bg: '#E8E2FF', fg: '#4F3CC9', label: 'Order received' },
  preparing: { bg: '#FFF4DE', fg: '#8A5A00', label: 'Preparing' },
  ready: { bg: '#E8F0FE', fg: '#1A56DB', label: 'Ready' },
  out_for_delivery: { bg: '#E0F2F1', fg: '#00695C', label: 'Out for delivery' },
  delivered: { bg: '#E6F4EA', fg: '#1E7A34', label: 'Delivered' },
  cancelled: { bg: '#EEEEEE', fg: '#666666', label: 'Cancelled' },
};

const TRACK_STEPS = [
  { key: 'new', label: 'Received' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'out_for_delivery', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
];

function formatOrderDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Premium order card — dark receipt header, live kitchen strip, itemised bill + journey. */
function OrderCard({ order }: { order: ApiHistoryOrder }) {
  const tone = STATUS_TONE[order.status] ?? { bg: Brand.clay, fg: Brand.stone, label: order.status };
  const ful = order.fulfillment_status ?? 'new';
  const ftone = FULFILL_TONE[ful] ?? { bg: Brand.clay, fg: Brand.stone, label: ful };
  const stepIdx = TRACK_STEPS.findIndex((s) => s.key === ful);
  const count = order.items.reduce((s, l) => s + (l.qty || 0), 0);
  const subtotal = order.subtotal ?? order.items.reduce((s, l) => s + l.unit * l.qty, 0);
  const discount = order.discount ?? 0;
  // total = subtotal - discount + delivery (offer ke baad ye formula badal gaya tha).
  const delivery = Math.max(0, order.total - subtotal + discount);
  const cancelled = ful === 'cancelled';
  return (
    <View style={styles.orderCard}>
      <View style={styles.ordHeader}>
        <View style={styles.ordHeadLeft}>
          <Text style={styles.ordIdBig}>Order #{order.id}</Text>
          {order.created_at ? <Text style={styles.ordDateLight}>{formatOrderDate(order.created_at)}</Text> : null}
        </View>
        <View style={styles.ordHeadRight}>
          <Text style={styles.ordTotalBig}>₹{order.total}</Text>
          <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.statusText, { color: tone.fg }]}>{tone.label}</Text>
          </View>
        </View>
      </View>

      {order.status === 'paid' && (
        <View style={[styles.ordStrip, { backgroundColor: ftone.bg }]}>
          <View style={[styles.ordPulse, { backgroundColor: ftone.fg }]} />
          <Text style={[styles.ordStripText, { color: ftone.fg }]} numberOfLines={2}>
            {cancelled
              ? 'Cancelled by the shop — refund ho jayega'
              : `${ftone.label} • ${count} item${count === 1 ? '' : 's'}`}
          </Text>
        </View>
      )}
      {order.offer_name ? (
        <View style={[styles.ordStrip, { backgroundColor: '#E9F5EC' }]}>
          <Text style={[styles.ordStripText, { color: '#1E4D2B' }]} numberOfLines={2}>
            🎉 {order.offer_name} applied{discount > 0 ? ` • −₹${discount}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.ordBody}>
        {order.delivery_address ? (
          <Text style={styles.orderAddr} numberOfLines={2}>
            ⌂ {order.delivery_address}
          </Text>
        ) : null}
        {order.status === 'failed' && order.failure_reason ? (
          <Text style={styles.orderFailReason} numberOfLines={2}>
            Reason: {order.failure_reason}
          </Text>
        ) : null}

        <View style={styles.ordItems}>
          {order.items.map((l, i) => (
            <View key={`${l.id}:${l.portion}:${i}`} style={styles.ordItemRow}>
              <View style={styles.qtyChip}>
                <Text style={styles.qtyText}>×{l.qty}</Text>
              </View>
              <Text style={styles.ordItemName} numberOfLines={2}>
                {l.name}
                {l.portion !== 'single' ? ` (${portionLabel(l.portion as Portion)})` : ''}
                {l.free ? ' 🎉 FREE' : ''}
              </Text>
              <Text style={styles.ordItemAmt}>{l.free ? 'FREE' : `₹${l.unit * l.qty}`}</Text>
            </View>
          ))}
        </View>

        <View style={styles.receipt}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLbl}>Item total ({count})</Text>
            <Text style={styles.receiptVal}>₹{subtotal}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLbl, styles.billFree]}>Offer discount{order.offer_name ? ` (${order.offer_name})` : ''}</Text>
              <Text style={[styles.receiptVal, styles.billFree]}>−₹{discount}</Text>
            </View>
          )}
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLbl}>Delivery</Text>
            <Text style={styles.receiptVal}>₹{delivery}</Text>
          </View>
            <View style={[styles.receiptRow, styles.receiptTotal]}>
              <Text style={styles.orderTotalLabel}>Total amount</Text>
              <Text style={styles.orderTotalValue}>₹{order.total}</Text>
            </View>
        </View>

        {order.status === 'paid' && !cancelled && (
          <View style={styles.track}>
            {TRACK_STEPS.map((s, i) => {
              const done = stepIdx >= 0 && i <= stepIdx;
              const current = stepIdx >= 0 && i === stepIdx;
              return (
                <View key={s.key} style={styles.trackStep}>
                  <View style={[styles.trackDot, done && styles.trackDone, current && styles.trackCurrent]}>
                    {done && <Text style={styles.trackTick}>✓</Text>}
                  </View>
                  <Text style={[styles.trackLabel, done && styles.trackLabelDone]}>{s.label}</Text>
                  {i < TRACK_STEPS.length - 1 && <View style={[styles.trackLine, i < stepIdx && styles.trackLineDone]} />}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Ticking countdown — har second ghat-ta hai, khatam hote hi null.
 * Apna interval khud chalata hai taaki parent re-render na ho.
 */
function useRemainingMs(endsAt: string | null): number | null {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt || new Date(endsAt).getTime() <= Date.now()) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - nowMs;
  return ms > 0 ? ms : null;
}

/**
 * Sale-timer chip — banner ke top-right me ⏳ 01:59:33, har second ghat-ta hai.
 * Khatam hote hi gayab (banner agle refresh me list se hat jayega).
 */
const BannerTimerChip = memo(function BannerTimerChip({ endsAt }: { endsAt: string }) {
  const ms = useRemainingMs(endsAt);
  if (ms == null) return null;
  return (
    <View style={styles.bannerTimer}>
      <Text style={styles.bannerTimerText}>⏳ {formatTimer(ms)}</Text>
    </View>
  );
});
/**
 * Isolated offer carousel — dot updates re-render only this component,
 * so swiping never re-renders the long menu list (keeps scrolling smooth).
 */
const OfferCarousel = memo(function OfferCarousel({
  items,
  onPress,
}: {
  items: BannerSlide[];
  onPress: (target: string | null) => void;
}) {
  const [idx, setIdx] = useState(0);
  // Naya data aaye to clamp — dots/list kabhi mismatch nahi honge (bina effect ke).
  const safeIdx = Math.min(idx, Math.max(0, items.length - 1));
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        snapToInterval={BANNER_W + BANNER_GAP}
        snapToAlignment="start"
        onMomentumScrollEnd={(e) =>
          setIdx(Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + BANNER_GAP)))
        }>
        {items.map((b) => (
          <Pressable
            key={b.key}
            style={[styles.banner, { backgroundColor: b.bg, width: BANNER_W }]}
            onPress={() => onPress(b.target)}>
            <View>
              <Text style={[styles.bannerTitle, { color: b.fg }]}>{b.title}</Text>
              {b.text ? <Text style={[styles.bannerText, { color: b.sub }]}>{b.text}</Text> : null}
            </View>
            <View style={[styles.bannerPill, { backgroundColor: b.pillBg }]}>
              <Text style={[styles.bannerPillText, { color: b.pillFg }]}>{b.pill}</Text>
            </View>
            {b.endsAt ? <BannerTimerChip endsAt={b.endsAt} /> : null}
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {items.map((b) => (
          <View key={b.key} style={[styles.dot, b.key === items[safeIdx]?.key && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
});

/**
 * Zomato-style home: location header, search, offer banners,
 * category tiles, bestsellers, full menu, cart bar + bottom tabs.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { ready, token, user, logout, forceLogout, updateProfile } = useAuth();
  const { lines, count, total, clear, add, removeLine } = useCart();
  // System nav / gesture bar ke upar sheet button rahe — dev build me checkout dab gaya tha.
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('home');
  const [menu, setMenu] = useState(MENU);
  const [offline, setOffline] = useState(false);
  // Live offer banners (admin panel) — null = abhi load nahi hue, tab tak brand slides.
  // Empty array = admin ne koi banner nahi banaya, tab bhi brand slides (design safe).
  const [liveBanners, setLiveBanners] = useState<ApiBanner[] | null>(null);
  // Live offers (discount + free item) — bill preview ke liye; final hisaab server ka.
  const [offers, setOffers] = useState<ApiOffer[]>([]);
  // Admin dashboard switch — false = orders band, banner + checkout block.
  const [shopOpen, setShopOpen] = useState(true);
  // Live shop rules — /shop-status se aate hain (admin Settings se turant badalte hain).
  // SHOP.* sirf bundled fallback hai (offline/server-down pe).
  const [shopCfg, setShopCfg] = useState({
    radiusM: SHOP.radiusM,
    minOrder: SHOP.minOrder,
    deliveryCharge: SHOP.deliveryCharge,
    deliveryMode: 'fixed' as 'fixed' | 'distance',
    deliveryBase: SHOP.deliveryCharge,
    deliveryFreeM: 1000,
    deliveryPer500m: 4,
  });
  // Pull-to-refresh spinner.
  const [refreshing, setRefreshing] = useState(false);
  /** Server values ko validate karke lagao — kachra aaye to purana rakho. */
  const applyShopStatus = useCallback(
    (s: {
      radius_m?: unknown;
      min_order?: unknown;
      delivery_charge?: unknown;
      delivery_mode?: unknown;
      delivery_base?: unknown;
      delivery_free_m?: unknown;
      delivery_per_500m?: unknown;
    }) => {
      setShopCfg((prev) => ({
        radiusM: typeof s.radius_m === 'number' && Number.isFinite(s.radius_m) && s.radius_m >= 100 && s.radius_m <= 20000
          ? Math.round(s.radius_m) : prev.radiusM,
        minOrder: typeof s.min_order === 'number' && Number.isFinite(s.min_order) && s.min_order >= 0
          ? Math.round(s.min_order) : prev.minOrder,
        deliveryCharge: typeof s.delivery_charge === 'number' && Number.isFinite(s.delivery_charge) && s.delivery_charge >= 0
          ? Math.round(s.delivery_charge) : prev.deliveryCharge,
        deliveryMode: s.delivery_mode === 'distance' ? 'distance' : 'fixed',
        deliveryBase: typeof s.delivery_base === 'number' && Number.isFinite(s.delivery_base) && s.delivery_base >= 0
          ? Math.round(s.delivery_base) : prev.deliveryBase,
        deliveryFreeM: typeof s.delivery_free_m === 'number' && Number.isFinite(s.delivery_free_m) && s.delivery_free_m >= 0
          ? Math.round(s.delivery_free_m) : prev.deliveryFreeM,
        deliveryPer500m: typeof s.delivery_per_500m === 'number' && Number.isFinite(s.delivery_per_500m) && s.delivery_per_500m >= 0
          ? Math.round(s.delivery_per_500m) : prev.deliveryPer500m,
      }));
    },
    [],
  );
  /**
   * Silent live refresh — menu + shop + banners + offers ek sath.
   * Polling (25s), foreground-resume aur pull-to-refresh sab yahi chalate hain,
   * taaki naya offer/banner kahin se bhi miss na ho. Koi shimmer nahi.
   */
  const refreshLive = useCallback(async () => {
    try {
      const cats = await api.menu();
      const fresh = fromApi(cats);
      setLiveMenu(fresh);
      setMenu(fresh);
      setOffline(false);
    } catch {}
    try {
      const s = await api.shopStatus();
      setShopOpen(s.shop_open);
      applyShopStatus(s);
    } catch {}
    try {
      const list = await api.banners();
      if (Array.isArray(list)) setLiveBanners(list);
    } catch {}
    try {
      const list = await api.offers();
      if (Array.isArray(list)) setOffers(list);
    } catch {}
  }, [applyShopStatus]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshLive();
    } finally {
      setRefreshing(false);
    }
  }, [refreshLive]);
  const [query, setQuery] = useState('');
  const [menuFilter, setMenuFilter] = useState('all');
  const [cartOpen, setCartOpen] = useState(false);
  // Keyboard ki height — khula ho to sheet sikud ke address box dikhaye.
  const [kbH, setKbH] = useState(0);
  const sheetBodyRef = useRef<ScrollView>(null);
  // Address box pe jump + focus ke liye refs.
  const addrInputRef = useRef<TextInput>(null);
  const addrBoxY = useRef(0);
  // Main list ScrollView — category switch pe top pe le jao (issue: bottom pe atka rehta tha).
  const scrollRef = useRef<ScrollView>(null);
  // Logout button loader — server hang ho to bhi UI stuck nahi lagegi.
  const [loggingOut, setLoggingOut] = useState(false);
  const [address, setAddress] = useState('');
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  // Shimmer states — first load after login + every tab switch.
  const [menuLoading, setMenuLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  // Category filter shimmer — brief skeleton when switching menu categories.
  const [filterLoading, setFilterLoading] = useState(false);
  // Checkout states — geofence + min order + Razorpay.
  // validating = pehla click (shop/menu checks) → sirf button pe loader, koi overlay nahi.
  // placingOrder = delivery popup ke baad (GPS + place order) → full overlay "Placing your order…".
  const [validating, setValidating] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  // Profile states — editable naam + default address (server pe save hota hai).
  const [profileName, setProfileName] = useState('');
  const [profileAddr, setProfileAddr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  // Delivery zone — profile kholte hi live GPS se check.
  const [zoneState, setZoneState] = useState<'idle' | 'checking' | 'inside' | 'outside' | 'denied'>('idle');
  const [zoneDist, setZoneDist] = useState<number | null>(null);
  const [alert, setAlert] = useState<AppAlertData | null>(null);
  const showAlert = useCallback((title: string, message: string, type: AppAlertData['type'] = 'info') => {
    setAlert({ title, message, type });
  }, []);
  const [verifying, setVerifying] = useState(false);
  // Order history states.
  const [orders, setOrders] = useState<ApiHistoryOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  // Active = abhi kaam chal raha hai (delivered/cancelled yaha nahi dikhte).
  const [ordersTab, setOrdersTab] = useState<'active' | 'past'>('active');
  const loadOrders = useCallback(async (silent = false) => {
    if (!token) {
      setOrders([]);
      return;
    }
    if (!silent) setOrdersLoading(true);
    try {
      setOrders(await api.orders(token));
    } catch (e) {
      // Dead token (DB wipe/expiry) → clear session, redirect to login.
      if (e instanceof SessionExpiredError) {
        await forceLogout();
        return;
      }
      // Offline → keep showing the old list, fail silently.
    } finally {
      if (!silent) setOrdersLoading(false);
    }
  }, [token, forceLogout]);

  // Orders tab khula ho to har 10 sec me status refresh — admin ka status
  // change (preparing/ready/...) khud dikhega, bina refresh dabaye.
  useEffect(() => {
    if (tab !== 'orders') return;
    const t = setInterval(() => {
      loadOrders(true);
    }, 10000);
    return () => clearInterval(t);
  }, [tab, loadOrders]);

  // Token gaya (logout/expiry/401) to login pe wapas — spinner pe atke rahoge
  // to app band jaisi lagegi. Button ka replace fail ho tab bhi ye sambhal lega.
  useEffect(() => {
    if (ready && !token) router.replace('/auth');
  }, [ready, token, router]);

  // Keyboard open/close track — cart sheet us hisab se height badlegi.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Cart khali hote hi location reset — purana pin/charge chipakta nahi.
  // (Blunder tha: clear ke baad dobara add pe Get Location button hi nahi aata tha,
  // aur user move kar chuka ho to purane pin se order lag jata tha.)
  useEffect(() => {
    if (lines.length === 0) {
      setZoneState('idle');
      setZoneDist(null);
      posRef.current = null;
      snapRef.current = null;
    }
  }, [lines.length]);

  // Profile inputs server ke user se sync (ek user ke liye ek baar — typing beech me nahi kategi).
  useEffect(() => {
    setProfileName(user?.name ?? '');
    setProfileAddr(user?.default_address ?? '');
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Checkout me default address auto-fill — khud typed address kabhi overwrite nahi hoga.
  useEffect(() => {
    if (address === '' && user?.default_address) setAddress(user.default_address);
  }, [user?.default_address, address]);

  /** Live delivery-zone check — profile kholte hi + Check button pe. */
  const checkZone = useCallback(async () => {
    setZoneState('checking');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setZoneState('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const d = distanceMetres(pos.coords.latitude, pos.coords.longitude, SHOP.lat, SHOP.lng);
      setZoneDist(Math.round(d));
      setZoneState(d <= shopCfg.radiusM ? 'inside' : 'outside');
    } catch {
      setZoneState('denied');
    }
  }, [shopCfg.radiusM]);

  // Profile kholte hi zone + orders count fresh (silent — koi shimmer nahi).
  useEffect(() => {
    if (tab !== 'profile') return;
    void checkZone();
    void loadOrders(true);
  }, [tab, checkZone, loadOrders]);

  /** Naam + default address server pe save. */
  const saveProfile = useCallback(async () => {
    if (savingProfile) return;
    const nm = profileName.trim();
    const ad = profileAddr.trim();
    if (nm.length < 2) {
      showAlert('Name too short', 'Please enter your name (at least 2 characters).', 'warning');
      return;
    }
    if (ad !== '' && ad.length < 10) {
      showAlert(
        'Incomplete address',
        'Write at least 10 characters with house number + landmark — or leave it empty.',
        'warning',
      );
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ name: nm, default_address: ad === '' ? null : ad });
      showAlert('Profile saved!', 'Your name and delivery address have been saved.', 'success');
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await forceLogout();
        return;
      }
      showAlert('Could not save', e instanceof Error ? e.message : 'Please try again.', 'error');
    } finally {
      setSavingProfile(false);
    }
  }, [savingProfile, profileName, profileAddr, updateProfile, showAlert, forceLogout]);
  const [rzpOrderId, setRzpOrderId] = useState<number | null>(null);
  const [rzpData, setRzpData] = useState<RazorpayCheckoutData | null>(null);
  const paymentDoneRef = useRef(false);
  /** Frozen order for the in-flight checkout — see CheckoutSnap. */
  const snapRef = useRef<CheckoutSnap | null>(null);
  // Proceed ka GPS pin (POS_FRESH_MS tak fresh) — cart me dikhaya charge aur
  // payment wala pin ek hi rahe, double GPS wait na ho.
  const posRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const tabRef = useRef<Tab>('home');
  const tabTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ready && !token) router.replace('/auth');
  }, [ready, token, router]);

  useEffect(() => {
    let alive = true;
    // Safety: skeleton hides after 8s even if the API hangs.
    const fallback = setTimeout(() => {
      if (alive) {
        setOffline(true);
        setMenuLoading(false);
      }
    }, 8000);
    api
      .menu()
      .then((cats) => {
        if (alive) {
          const fresh = fromApi(cats);
          setLiveMenu(fresh);
          setMenu(fresh);
        }
      })
      .catch(() => {
        if (alive) setOffline(true);
      })
      .finally(() => {
        if (alive) {
          clearTimeout(fallback);
          setMenuLoading(false);
        }
      });
    // Shop open/closed — admin dashboard switch. Fail silent, default open.
    api
      .shopStatus()
      .then((s) => {
        if (alive) {
          setShopOpen(s.shop_open);
          applyShopStatus(s);
        }
      })
      .catch(() => {});
    // Home offer banners — admin panel se. Fail/empty = brand slides (koi shimmer nahi).
    api
      .banners()
      .then((list) => {
        if (alive && Array.isArray(list)) setLiveBanners(list);
      })
      .catch(() => {});
    // Live offers — bill preview. Fail = koi offer nahi (server final hisaab karega).
    api
      .offers()
      .then((list) => {
        if (alive && Array.isArray(list)) setOffers(list);
      })
      .catch(() => {});
    // A. Silent polling — khuli app me menu + status + banners + offers fresh rahe (koi shimmer nahi).
    // Admin rate/availability/banner/offer change ~25 sec me bina reopen ke dikhega.
    // (Ek hi refreshLive — chaaro endpoints ek sath, kahin miss na ho.)
    const poll = setInterval(() => {
      void refreshLive();
    }, 25000);
    return () => {
      alive = false;
      clearTimeout(fallback);
      clearInterval(poll);
    };
  }, [refreshLive, applyShopStatus]);

  // App background se wapas aaye to turant fresh — interval background me
  // throttle hota hai, isliye resume pe naya offer/banner turant dikhega.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshLive();
    });
    return () => sub.remove();
  }, [refreshLive]);

  useEffect(
    () => () => {
      if (tabTimer.current) clearTimeout(tabTimer.current);
      if (filterTimer.current) clearTimeout(filterTimer.current);
    },
    [],
  );

  /** Brief shimmer on every screen change — bottom tabs, banners, See all, Browse menu. */
  const switchTab = useCallback((key: Tab) => {
    if (tabRef.current === key) return;
    tabRef.current = key;
    // Search dusre tab me leak na ho — har tab apni shuruaat se khule.
    setQuery('');
    setTab(key);
    setTabLoading(true);
    if (tabTimer.current) clearTimeout(tabTimer.current);
    tabTimer.current = setTimeout(() => setTabLoading(false), 450);
    if (key === 'orders') loadOrders();
  }, [loadOrders]);

  // Push token — login ke baad backend ko do (order status pushes ke liye).
  // Status Profile me dikhta hai taaki pata chale token gaya ya kahan atka.
  const [pushState, setPushState] = useState<'checking' | 'on' | 'off'>('checking');
  const [pushReason, setPushReason] = useState('');
  const [pushBusy, setPushBusy] = useState(false);

  const enablePush = useCallback(async () => {
    if (!token) {
      setPushState('off');
      setPushReason('Please log in and try again');
      return false;
    }
    setPushBusy(true);
    try {
      const r = await registerPushTokenDetailed();
      if (!r.ok) {
        setPushState('off');
        setPushReason(r.reason);
        return false;
      }
      await api.pushToken(token, {
        token: r.token,
        platform: Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : undefined,
      });
      setPushState('on');
      setPushReason('');
      return true;
    } catch {
      setPushState('off');
      setPushReason('Could not save on the server');
      return false;
    } finally {
      setPushBusy(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setPushState('off');
      setPushReason('Will try automatically after login');
      return;
    }
    void enablePush();
  }, [token, enablePush]);

  // Push aaye to: foreground me list refresh, tap pe relatable screen kholo.
  // (Expo Go me listeners null — kuch nahi hota, polling cover karta hai.)
  // Tap data: {type: 'order_*', fulfillment_status?} → Orders tab + sahi sub-tab.
  const switchTabRef = useRef(switchTab);
  switchTabRef.current = switchTab;
  useEffect(() => {
    // Cold start — app band thi, notification tap pe khuli.
    const pending = consumePendingOrdersTab();
    if (pending) {
      switchTabRef.current('orders');
      setOrdersTab(pending);
    }
    const recv = addPushReceivedListener(() => {
      loadOrders(true);
    });
    const resp = addPushResponseListener((data) => {
      if (data && !isOrderPush(data)) return;
      loadOrders(true);
      switchTabRef.current('orders');
      setOrdersTab(ordersTabFromPushData(data));
    });
    return () => {
      recv?.remove();
      resp?.remove();
    };
  }, [loadOrders]);

  /** Brief shimmer on category change — so users see dishes are reloading. */
  const selectFilter = useCallback(
    (key: string) => {
      if (key === menuFilter) return;
      setMenuFilter(key);
      // Nayi category hamesha top se dikhe — warna bottom pe atke rehte the.
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      // Restart the shimmer on every tap (even rapid ones).
      setFilterLoading(true);
      if (filterTimer.current) clearTimeout(filterTimer.current);
      filterTimer.current = setTimeout(() => setFilterLoading(false), 500);
    },
    [menuFilter],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return menu.flatMap((c) => c.items).filter((i) => i.name.toLowerCase().includes(q));
  }, [query, menu]);

  const timePicks = useMemo(() => {
    const h = new Date().getHours();
    const [label, sub, ids]: [string, string, number[]] =
      h >= 5 && h < 11
        ? ['Good morning! Breakfast is on', 'Fresh from the tandoor, all morning', [1, 11, 83, 10]]
        : h >= 11 && h < 16
          ? ['Lunch time specials', 'Hot, hearty and homestyle', [26, 27, 28, 29, 32, 11]]
          : h >= 16 && h < 20
            ? ['Evening cravings', 'Chai-time favourites', [55, 20, 63, 89, 103, 93]]
            : ['Late night bites', 'Maggi, momos & coolers', [78, 98, 55, 93]];
    return {
      label,
      sub,
      items: ids.map((id) => findItem(id)).filter((x): x is MenuItem => Boolean(x)),
    };
  }, []);

  const dealOfDay = useMemo(
    () => menu.flatMap((c) => c.items).find((i) => i.id === 26),
    [menu],
  );

  /** Pocket friendly — fixed 8 photo items under ₹99. */
  const pocketFriendly = useMemo(() => {
    const ids = [1, 2, 3, 5, 6, 8, 9, 10];
    const live = menu.flatMap((c) => c.items);
    return ids
      .map((id) => live.find((i) => i.id === id))
      .filter((x): x is MenuItem => Boolean(x));
  }, [menu]);

  const menuSections = useMemo(
    () => (menuFilter === 'all' ? menu : menu.filter((c) => c.key === menuFilter)),
    [menu, menuFilter],
  );

  /**
   * Home banners — admin ke live banners ho to wahi, warna brand slides.
   * Admin zero banners = design same rahegi, koi jhootha offer nahi dikhega.
   * (Timer chip apna second khud gin-ta hai — yaha koi ticking state nahi.)
   */
  const bannerSlides: BannerSlide[] = useMemo(() => {
    if (liveBanners && liveBanners.length > 0) {
      return liveBanners.map((b) => ({
        key: `live-${b.id}`,
        title: b.title,
        text: b.subtitle ?? '',
        pill: b.pill_text || 'Open',
        target: b.target,
        endsAt: b.offer_ends_at ?? null,
        ...(BANNER_THEMES[b.theme] ?? BANNER_THEMES.espresso),
      }));
    }
    return FALLBACK_BANNERS;
  }, [liveBanners]);

  /** Bestsellers — live menu se (admin ke bestseller flag + rate ke sath).
   *  API na mile to bundled fallback (offline mode). */
  const bestsellers = useMemo(() => {
    const live = menu.flatMap((c) => c.items).filter((i) => i.bestseller);
    return live.length > 0 ? live : BESTSELLERS;
  }, [menu]);

  /** Food subtotal = total; offer discount server mirror karke preview; payable = subtotal - discount + delivery. */
  const catByItemId = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of menu) for (const i of c.items) m.set(i.id, c.key);
    return m;
  }, [menu]);
  const pickedOffer = useMemo(
    () =>
      pickBestOffer(
        offers,
        lines.map((l) => ({
          id: l.item.id,
          qty: l.qty,
          unit: l.unit,
          category: catByItemId.get(l.item.id) ?? '',
        })),
        total,
      ),
    [offers, lines, total, catByItemId],
  );
  const offerDiscount = pickedOffer?.discount ?? 0;
  // Cart strip ka timer (har second) — header hook, hamesha same order me chalega.
  const offerLeftMs = useRemainingMs(pickedOffer?.offer.ends_at ?? null);
  // Keyboard khula ho to bachi hui jagah me sheet fit karo (chrome + footer nikaal ke).
  const availH = WIN_H - kbH;
  const bodyMaxH = kbH > 0 ? Math.max(140, availH - 270) : SHEET_BODY_MAX_H;
  // Zone check ho chuka ho to exact distance wala charge, warna kuch nahi.
  // Location fetch se pehle delivery row hi nahi dikhti — guess wala base
  // charge dikhana band (transparency: user wahi dekhe jo pay karega).
  // Final charge hamesha server (GPS pin pe) lagata hai.
  const previewDist = zoneState === 'inside' && zoneDist != null ? zoneDist : null;
  const deliveryKnown = previewDist != null;
  const deliveryFee =
    lines.length > 0 && deliveryKnown
      ? deliveryChargeFor(previewDist, {
          deliveryMode: shopCfg.deliveryMode,
          deliveryCharge: shopCfg.deliveryCharge,
          deliveryBase: shopCfg.deliveryBase,
          deliveryFreeM: shopCfg.deliveryFreeM,
          deliveryPer500m: shopCfg.deliveryPer500m,
        })
      : 0;
    const payable = total - offerDiscount + deliveryFee;  /** Profile summary — paid orders ka kharcha. */
  const orderCount = orders.filter((o) => o.status === 'paid').length;
  const orderSpent = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0);
  /** Orders tab me SIRF fully-paid orders — pending/failed kabhi nahi dikhenge. */
  const paidOrders = orders.filter((o) => o.status === 'paid');
  /** Orders tab split — delivered/cancelled Active se hat ke Past me jate hain. */
  const isPastOrder = (o: ApiHistoryOrder) => {
    const f = o.fulfillment_status ?? 'new';
    return f === 'delivered' || f === 'cancelled';
  };
  const activeOrders = paidOrders.filter((o) => !isPastOrder(o));
  const pastOrders = paidOrders.filter(isPastOrder);
  const shownOrders = ordersTab === 'active' ? activeOrders : pastOrders;

  const initial = (user?.name?.trim()?.charAt(0) ?? user?.phone?.charAt(0) ?? 'D').toUpperCase();

  const openCategory = useCallback(
    (key: string) => {
      selectFilter(key);
      switchTab('menu');
    },
    [switchTab, selectFilter],
  );

  /**
   * Banner tap — sirf asli category pe khule. Admin ne galat target likha
   * ho to kuch nahi hoga (khaali menu screen kabhi nahi khulegi).
   */
  const openBanner = useCallback(
    (target: string | null) => {
      if (!target) return;
      if (target !== 'all' && !menu.some((c) => c.key === target)) return;
      openCategory(target);
    },
    [menu, openCategory],
  );

  const searching = results !== null && (tab === 'home' || tab === 'menu');
  const showSkeleton = menuLoading || tabLoading;
  // Filter shimmer only — chips stay visible, only dish rows shimmer.
  const showFilterShimmer = filterLoading && !menuLoading && !tabLoading;

  /**
   * Add Address pe seedha textbox pe le jao — dishes jyada ho to box neeche
   * daba hota hai, user ko pata nahi chalta kaha likhna hai.
   * Alert close hone ke baad scroll + focus (keyboard khul jayega).
   */
  const focusAddress = useCallback(() => {
    setAlert(null);
    setTimeout(() => {
      sheetBodyRef.current?.scrollTo({ y: Math.max(0, addrBoxY.current - 12), animated: true });
      // Scroll ke baad focus — thoda gap taaki keyboard sheet ko dhakka na de.
      setTimeout(() => addrInputRef.current?.focus(), 350);
    }, 300);
  }, []);

  // Cart location loader — Get Your Location button ka spinner.
  const [locating, setLocating] = useState(false);
  /**
   * Cart me location fetch — button tap pe GPS pin, usi se delivery charge.
   * Pin milte hi bill me Delivery + To pay + Proceed button aa jate hain.
   * Pin 90s tak posRef me rehta hai taaki Proceed pe dobara wait na ho.
   */
  const fetchCartLocation = useCallback(async () => {
    if (locating || placingOrder || validating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Location needed',
          `We need your location to show delivery charge (within ${radiusLabel(shopCfg.radiusM)} of Dev Ratna Diner).`,
          'warning',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const dist = distanceMetres(pos.coords.latitude, pos.coords.longitude, SHOP.lat, SHOP.lng);
      if (dist > shopCfg.radiusM) {
        showAlert(
          'Outside delivery area',
          `We deliver within ${radiusLabel(shopCfg.radiusM)} of Dev Ratna Diner only. Please order when you are nearby.`,
          'error',
        );
        return;
      }
      setZoneDist(Math.round(dist));
      setZoneState('inside');
      posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
      // Bill (Delivery + To pay + Proceed) dikhe — wahi tak scroll.
      setTimeout(() => sheetBodyRef.current?.scrollToEnd({ animated: true }), 250);
    } finally {
      setLocating(false);
    }
  }, [locating, placingOrder, validating, shopCfg.radiusM, showAlert]);

  /**
   * Checkout flow — live geofence + live min food (admin Settings se),
   * then Razorpay order (backend) → payment → verify → confirm.
   * Address is optional landmark-only — eligibility is decided by live GPS.
   *
   * GPS pin Proceed pe startCheckout me liya jata hai (cart me exact charge
   * dikhane ke liye) — yaha wahi cached pin reuse hota hai (90s fresh),
   * taaki dikhaya charge aur billed pin ek hi ho. Cache na ho to khud lega.
   *
   * Runs ONLY on the frozen CheckoutSnap taken at Proceed tap — never on live
   * cart state, so the 2–3s GPS wait can't be corrupted by mid-flight edits.
   */
  const continueCheckout = useCallback(async () => {
    const snap = snapRef.current;
    if (!snap || snap.lines.length === 0) return;
    if (!token) {
      router.replace('/auth');
      return;
    }
    setPlacingOrder(true);
    try {
      // Sirf Proceed wala fresh pin — stale pin se payment kabhi nahi.
      // (Proceed ke seconds baad Pay dabta hai to pin fresh hi milta hai.)
      // Pin purana/missing ho (confirm pe ruke rahe, app background gayi) to
      // dobara Proceed karwao — naya pin + naya charge + naya confirm.
      const cached = posRef.current;
      if (!cached || Date.now() - cached.at > POS_FRESH_MS) {
        posRef.current = null;
        showAlert(
          'Location expired',
          'Your location check expired. Please tap Proceed again for fresh delivery charge.',
          'warning',
        );
        return;
      }
      const latitude = cached.lat;
      const longitude = cached.lng;
      posRef.current = null;
      const dist = distanceMetres(latitude, longitude, SHOP.lat, SHOP.lng);
      if (dist > shopCfg.radiusM) {
        showAlert(
          'Outside delivery area',
          `We deliver within ${radiusLabel(shopCfg.radiusM)} of Dev Ratna Diner only. Please order when you are nearby.`,
          'error',
        );
        return;
      }
      const placed = await api.placeOrder(token, {
        items: snap.lines.map((l) => ({ id: l.item.id, portion: l.portion, qty: l.qty })),
        lat: latitude,
        lng: longitude,
        address: snap.address || null,
      });
      // GPS pin milte hi exact distance-charge snap pe (display consistency;
      // Razorpay amount hamesha server ka authoritative hota hai).
      const exactFee = deliveryChargeFor(dist, {
        deliveryMode: shopCfg.deliveryMode,
        deliveryCharge: shopCfg.deliveryCharge,
        deliveryBase: shopCfg.deliveryBase,
        deliveryFreeM: shopCfg.deliveryFreeM,
        deliveryPer500m: shopCfg.deliveryPer500m,
      });
      snap.deliveryFee = exactFee;
      snap.payable = snap.total - (pickedOffer?.discount ?? 0) + exactFee;
      paymentDoneRef.current = false;
      setRzpOrderId(placed.order.id);
      setRzpData({ ...placed.razorpay, name: user?.name ?? undefined, phone: user?.phone });
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await forceLogout();
        return;
      }
      showAlert('Order failed', e instanceof Error ? e.message : 'Please try again.', 'error');
    } finally {
      snapRef.current = null;
      setPlacingOrder(false);
    }
  }, [token, user?.name, user?.phone, showAlert, forceLogout, shopCfg, pickedOffer, router]);

  const startCheckout = useCallback(async () => {
    if (validating || placingOrder) return;
    if (lines.length === 0) return;
    // Pehla click — sirf button pe loader (overlay nahi).
    // "Placing your order…" overlay sirf delivery popup ke baad continueCheckout me ayega.
    setValidating(true);
    // Fresh shop rules — admin ne band/rate change kiya to yahi ruko (backend bhi guard karta hai).
    // Isi flow me fresh values turant lagao (state async hai, agli baar se apne aap fresh).
    let liveMin = shopCfg.minOrder;
    let liveCharge = shopCfg.deliveryCharge;
    let liveRadius = shopCfg.radiusM;
    // Distance mode ke live params (freeze preview ke liye; exact GPS ke baad lagta hai).
    let liveMode = shopCfg.deliveryMode;
    let liveBase = shopCfg.deliveryBase;
    let liveFreeM = shopCfg.deliveryFreeM;
    let livePer500m = shopCfg.deliveryPer500m;
    try {
      const s = await api.shopStatus();
      setShopOpen(s.shop_open);
      applyShopStatus(s);
      if (typeof s.radius_m === 'number' && Number.isFinite(s.radius_m) && s.radius_m >= 100 && s.radius_m <= 20000) liveRadius = Math.round(s.radius_m);
      if (typeof s.min_order === 'number' && Number.isFinite(s.min_order) && s.min_order >= 0) liveMin = Math.round(s.min_order);
      if (typeof s.delivery_charge === 'number' && Number.isFinite(s.delivery_charge) && s.delivery_charge >= 0) liveCharge = Math.round(s.delivery_charge);
      if (s.delivery_mode === 'distance') liveMode = 'distance';
      if (typeof s.delivery_base === 'number' && Number.isFinite(s.delivery_base) && s.delivery_base >= 0) liveBase = Math.round(s.delivery_base);
      if (typeof s.delivery_free_m === 'number' && Number.isFinite(s.delivery_free_m) && s.delivery_free_m >= 0) liveFreeM = Math.round(s.delivery_free_m);
      if (typeof s.delivery_per_500m === 'number' && Number.isFinite(s.delivery_per_500m) && s.delivery_per_500m >= 0) livePer500m = Math.round(s.delivery_per_500m);
      if (!s.shop_open) {
        showAlert(
          'Shop is closed',
          'We are not accepting orders right now. Please try again when we are open (7:30 AM – 11:00 PM).',
          'warning',
        );
        setValidating(false);
        return;
      }
    } catch {
      if (!shopOpen) {
        showAlert('Shop is closed', 'We are not accepting orders right now. Please try again later.', 'warning');
        setValidating(false);
        return;
      }
    }
    // B0. Fresh offers — beech me nayi/expire hui deal ka preview sahi rahe.
    // (Final hisaab backend karta hai — ye sirf display ke liye.)
    try {
      const freshOffers = await api.offers();
      if (Array.isArray(freshOffers)) setOffers(freshOffers);
    } catch {
      // purani list pe bharosa, backend final guard karega.
    }
    // B. Checkout-time revalidation — cart ka fresh menu se milan.
    // Beech me OFF/deleted hui dishes auto-remove + naam ke sath batao.
    // (Backend phir bhi final guard hai — ye sirf smooth UX ke liye.)
    try {
      const cats = await api.menu();
      const fresh = fromApi(cats);
      setLiveMenu(fresh);
      setMenu(fresh);
      setOffline(false);
      const freshById = new Map(fresh.flatMap((c) => c.items).map((i) => [i.id, i]));
      const removed: string[] = [];
      for (const l of lines) {
        const f = freshById.get(l.item.id);
        if (!f || !f.available || unitPrice(f, l.portion) <= 0) {
          removed.push(l.item.name);
          removeLine(l.item.id, l.portion);
        }
      }
      if (removed.length > 0) {
        const unique = [...new Set(removed)];
        showAlert(
          lines.length === removed.length ? 'Cart khali ho gaya' : 'Menu updated',
          `"${unique.join('", "')}" ab available nahi hai — cart se hata diya.${
            lines.length === removed.length ? ' Kuch aur add karke dobara try karo.' : ' Baaki items check karke Proceed dobara dabao.'
          }`,
          'warning',
        );
        setValidating(false);
        return;
      }
    } catch {
      // Offline — cached cart pe bharosa, backend final guard karega.
    }
    if (!token) {
      // Session gayi (logout/expiry) — wapas login pe. Ye guard sirf race ke liye hai,
      // token gaya to redirect effect waise bhi login pe bhej deta hai.
      setValidating(false);
      router.replace('/auth');
      return;
    }
    if (total < liveMin) {
      const deliveryHint =
        liveMode === 'distance'
          ? `delivery ₹${liveBase} se (distance ke hisab se) extra`
          : `delivery ₹${liveCharge} extra`;
      showAlert(
        `Minimum order ₹${liveMin}`,
        `Add food worth ₹${liveMin - total} more (${deliveryHint}) to place your order.`,
        'warning',
      );
      setValidating(false);
      return;
    }
    // C. Proceed pe HAMESHA fresh GPS pin — purana pin kabhi reuse nahi.
    // User move kar sakta hai: purane pin se geofence pass + purana charge
    // freeze ho jana hi sabse bada loophole tha. Har Proceed = naya pin,
    // usi se geofence + cart display + freeze + confirm. Button wala pin
    // sirf display/pre-check ke liye tha, faisla hamesha is fresh pin pe.
    let latitude: number;
    let longitude: number;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setValidating(false);
        showAlert(
          'Location needed',
          `We need your location to show your exact delivery charge (within ${radiusLabel(liveRadius)} of Dev Ratna Diner).`,
          'warning',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      setValidating(false);
      showAlert('Location needed', 'Could not get your GPS location. Please turn on location and try again.', 'warning');
      return;
    }
    const dist = distanceMetres(latitude, longitude, SHOP.lat, SHOP.lng);
    if (dist > liveRadius) {
      setValidating(false);
      showAlert(
        'Outside delivery area',
        `We deliver within ${radiusLabel(liveRadius)} of Dev Ratna Diner only. Please order when you are nearby.`,
        'error',
      );
      return;
    }
    // Cart preview turant exact pe — bill row me saf dikhega.
    setZoneDist(Math.round(dist));
    setZoneState('inside');
    posRef.current = { lat: latitude, lng: longitude, at: Date.now() };
    const distLabel = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    // Freeze the bill synchronously — everything after this (place order)
    // runs on the snapshot, immune to mid-flight edits.
    // Discount preview hai — final hisaab server (OfferEngine + GPS pin) karega.
    // Delivery charge GPS pin wala exact hai — yahi cart me dikhta hai, yahi bill me.
    const liveDeliveryFee = deliveryChargeFor(dist, {
      deliveryMode: liveMode,
      deliveryCharge: liveCharge,
      deliveryBase: liveBase,
      deliveryFreeM: liveFreeM,
      deliveryPer500m: livePer500m,
    });
    const liveDiscount = pickedOffer?.discount ?? 0;
    const freezeBill = () => {
      snapRef.current = {
        lines: lines.map((l) => ({ ...l })),
        total,
        deliveryFee: liveDeliveryFee,
        payable: total - liveDiscount + liveDeliveryFee,
        address: address.trim(),
      };
    };
    if (address.trim().length < 10) {
      // Delivery popup kholna hai — button loader hatao, taaki user address type kar sake.
      // Skip pe continueCheckout khud placingOrder lock + overlay dikhayega.
      setValidating(false);
      setAlert({
        title: 'Add a delivery address?',
        message:
          'Your house number and landmark help our rider reach your doorstep quickly. Without it, the rider may have to call you for directions. Delivery goes to your current GPS location either way.',
        type: 'warning',
        actions: [
          { text: 'Add Address', primary: true, onPress: focusAddress },
          {
            text: 'Skip & Continue',
            onPress: () => {
              setAlert(null);
              freezeBill();
              void continueCheckout();
            },
          },
        ],
      });
      return;
    }
    // Address pehle se hai — exact charge dikha ke confirm, phir payment.
    // (Cart ki delivery row bhi exact pe update ho chuki hai.)
    setValidating(false);
    const liveToPay = total - liveDiscount + liveDeliveryFee;
    setAlert({
      title: 'Confirm delivery charge',
      message: `Your location is ${distLabel} from Dev Ratna Diner. Delivery charge ₹${liveDeliveryFee} — To pay ₹${liveToPay}.`,
      type: 'info',
      actions: [
        { text: 'Edit Cart', onPress: () => setAlert(null) },
        {
          text: `Pay ₹${liveToPay}`,
          primary: true,
          onPress: () => {
            setAlert(null);
            freezeBill();
            void continueCheckout();
          },
        },
      ],
    });
    return;
  }, [validating, placingOrder, lines, total, token, address, shopOpen, shopCfg, applyShopStatus, removeLine, showAlert, continueCheckout, router, pickedOffer, focusAddress]);

  const handleRzpSuccess = useCallback(
    async (p: RazorpaySuccess) => {
      if (!token || rzpOrderId == null || paymentDoneRef.current) return;
      paymentDoneRef.current = true;
      setRzpData(null);
      setVerifying(true);
      try {
        const res = await api.verifyOrder(token, { order_id: rzpOrderId, ...p });
        clear();
        setCartOpen(false);
        loadOrders();
        showAlert(
          'Order confirmed!',
          `Payment successful. Order #${res.order.id} • ₹${res.order.total} — your food is being prepared!`,
          'success',
        );
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await forceLogout();
          return;
        }
        showAlert(
          'Verification failed',
          e instanceof Error ? e.message : 'Please contact the shop with your payment details.',
          'error',
        );
      } finally {
        setVerifying(false);
        setRzpOrderId(null);
      }
    },
    [token, rzpOrderId, clear, showAlert, loadOrders, forceLogout],
  );

  /** Report gateway failures/cancels so the backend keeps the true reason. Never throws. */
  const reportFailure = useCallback(
    async (reason: string, code?: string) => {
      if (!token || rzpOrderId == null) return;
      try {
        await api.failOrder(token, { order_id: rzpOrderId, reason, code });
      } catch (e) {
        if (e instanceof SessionExpiredError) await forceLogout();
      }
    },
    [token, rzpOrderId, forceLogout],
  );

  const handleRzpCancel = useCallback(() => {
    // Ignore dismiss events arriving after a success.
    if (paymentDoneRef.current) return;
    setRzpData(null);
    setRzpOrderId(null);
    void reportFailure('Payment cancelled by user.', 'cancelled');
  }, [reportFailure]);

  const handleRzpError = useCallback(
    (message: string, code?: string) => {
      if (paymentDoneRef.current) return;
      setRzpData(null);
      setRzpOrderId(null);
      void reportFailure(message, code);
      showAlert('Payment failed', message, 'error');
    },
    [showAlert, reportFailure],
  );

  // Auth gate sab hooks ke BAAD — early return hooks se pehle hota to logout pe
  // "Rendered fewer hooks than expected" crash aata tha (wahi app-band wali dikkat).
  if (!ready || !token) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Brand.terracotta} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Fixed top bar — header + search + category filter stay visible, list scrolls below */}
      <View style={styles.topBar}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.locTitle}>⌂ Clement Town</Text>
            <Text style={styles.locSub}>Dev Ratna Diner, Dehradun</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.pureVeg}>
              <View style={styles.pureVegDot} />
              <Text style={styles.pureVegText}>PURE VEG</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>
        </View>

        {/* Search — sirf home/menu pe, taaki orders/profile pe purana search chipka na rahe */}
        {(tab === 'home' || tab === 'menu') && (
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder='Search "momos", "thali", "paneer"...'
              placeholderTextColor="#B4A69E"
              style={styles.searchInput}
            />
          </View>
        )}

        {offline ? (
          <Text style={styles.offline}>Showing saved menu — connect to refresh live items.</Text>
        ) : null}

        {!shopOpen && (
          <Text style={styles.closedBanner}>🔴 Shop is closed right now — orders resume when we open.</Text>
        )}

        {/* Category filter — stays fixed while the Menu tab scrolls.
            Stays visible even during filter shimmer so users can tap again. */}
        {tab === 'menu' && !searching && !menuLoading && !tabLoading && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBar}>
            {[{ key: 'all', label: 'All' }, ...menu.map((c) => ({ key: c.key, label: c.label }))].map(
              (c) => (
                <Pressable
                  key={c.key}
                  style={[styles.chip, menuFilter === c.key && styles.chipActive]}
                  onPress={() => selectFilter(c.key)}>
                  <Text style={[styles.chipText, menuFilter === c.key && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              ),
            )}
          </ScrollView>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {showSkeleton ? (
          <ScreenSkeleton tab={tab} />
        ) : (
          <>
        {tab === 'home' && !searching && (
          <>
            {/* Offer banners — admin live, warna brand slides */}
            <OfferCarousel items={bannerSlides} onPress={openBanner} />

            {/* Categories */}
            <Text style={styles.sectionTitle}>What&apos;s on your mind?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
              {menu.map((c) => (
                <Pressable key={c.key} style={styles.catTile} onPress={() => openCategory(c.key)}>
                  {c.tileImage ? (
                    <Image
                      source={FOOD_IMAGES[c.tileImage]}
                      style={styles.catImg}
                      contentFit="cover" cachePolicy="memory-disk" transition={200}
                    />
                  ) : (
                    <View style={[styles.catImg, styles.catMono]}>
                      <Text style={styles.catMonoText}>{c.label.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={styles.catLabel} numberOfLines={2}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Deal of the day */}
            <View style={styles.dealCard}>
              <Image
                source={dealOfDay?.image ? FOOD_IMAGES[dealOfDay.image] : FOOD_IMAGES['special-veg-thali']}
                style={styles.dealImg}
                contentFit="cover" cachePolicy="memory-disk" transition={200}
              />
              <View style={styles.dealScrim} />
              <View style={styles.dealBody}>
                <View style={styles.dealPill}>
                  <Text style={styles.dealPillText}>Deal of the day</Text>
                </View>
                <Text style={styles.dealTitle}>{dealOfDay?.name ?? 'Special Thali'}</Text>
                <Text style={styles.dealText} numberOfLines={2}>
                  {dealOfDay?.desc ?? 'Paneer + Dal + Roti + Raita + Rice + Salad'}
                </Text>
                <View style={styles.dealRow}>
                  <Text style={styles.dealPrice}>{dealOfDay?.priceLabel ?? '₹120'}</Text>
                  {dealOfDay && dealOfDay.available && dealOfDay.priceValue > 0 ? (
                    <Pressable style={styles.dealBtn} onPress={() => add(dealOfDay, 'single')}>
                      <Text style={styles.dealBtnText}>Add • {dealOfDay.priceLabel}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.unavailTag}>Not Available now</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Bestsellers */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Bestsellers near you</Text>
              <Pressable onPress={() => switchTab('menu')}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bestRow}>
              {bestsellers.map((item) => (
                <BestsellerCard key={item.id} item={item} onDetail={setDetailItem} />
              ))}
            </ScrollView>

            {/* Pocket friendly */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Pocket friendly • Under ₹99</Text>
              <Pressable onPress={() => switchTab('menu')}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bestRow}>
              {pocketFriendly.map((item) => (
                <Pressable key={item.id} style={styles.pocketCard} onPress={() => setDetailItem(item)}>
                  {item.image ? (
                    <Image source={FOOD_IMAGES[item.image]} style={styles.pocketImg} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                  ) : (
                    <View style={styles.pocketTile}>
                      <Text style={styles.pocketLetter}>{item.name.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={styles.pocketName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.pocketPrice}>{item.priceLabel}</Text>
                  {!item.available && <Text style={styles.unavailTag}>Not Available now</Text>}
                  <AddControl item={item} />
                </Pressable>
              ))}
            </ScrollView>

            {/* Right now — time-based picks (morning/lunch/evening/late-night) */}
            <Text style={styles.sectionTitle}>{timePicks.label}</Text>
            <Text style={styles.sectionSub}>{timePicks.sub}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bestRow}>
              {timePicks.items.map((item) => (
                <Pressable key={item.id} style={styles.pocketCard} onPress={() => setDetailItem(item)}>
                  {item.image ? (
                    <Image source={FOOD_IMAGES[item.image]} style={styles.pocketImg} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                  ) : (
                    <View style={styles.pocketTile}>
                      <Text style={styles.pocketLetter}>{item.name.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={styles.pocketName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.pocketPrice}>{item.priceLabel}</Text>
                  {!item.available && <Text style={styles.unavailTag}>Not Available now</Text>}
                  <AddControl item={item} />
                </Pressable>
              ))}
            </ScrollView>

            {/* Visit us */}
            <Text style={styles.sectionTitle}>Visit us in Clement Town</Text>
            <View style={styles.visitCard}>
              <View style={styles.visitRow}>
                <Text style={styles.visitStars}>★ 4.9</Text>
                <Text style={styles.visitText}>2,000+ happy ratings</Text>
              </View>
              <View style={styles.visitRow}>
                <Text style={styles.visitGlyph}>◷</Text>
                <Text style={styles.visitText}>Open daily • 7:30 AM – 11:00 PM</Text>
              </View>
              <View style={styles.visitRow}>
                <Text style={styles.visitGlyph}>⌂</Text>
                <Text style={styles.visitText}>Society Area, Behind Sakshi Electronics, Clement Town, Dehradun</Text>
              </View>
              <View style={styles.visitBtns}>
                <Pressable
                  style={styles.visitBtn}
                  onPress={() => Linking.openURL('tel:+919897012345')}>
                  <Text style={styles.visitBtnText}>Call us</Text>
                </Pressable>
                <Pressable
                  style={[styles.visitBtn, styles.visitBtnDark]}
                  onPress={() =>
                    Linking.openURL(
                      'https://www.google.com/maps/search/?api=1&query=Dev+Ratna+Diner+Clement+Town+Dehradun',
                    )
                  }>
                  <Text style={[styles.visitBtnText, styles.visitBtnDarkText]}>Directions</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {tab === 'menu' && !searching && (
          <>
            <Text style={styles.sectionTitle}>Menu</Text>
            {showFilterShimmer ? (
              <MenuListSkeleton rows={6} />
            ) : (
              menuSections.map((c) => (
                <View key={c.key}>
                  <Text style={styles.catHead}>
                    {c.label} • {c.items.length}
                  </Text>
                  {c.items.map((item) => (
                    <MenuRow key={item.id} item={item} onDetail={setDetailItem} />
                  ))}
                </View>
              ))
            )}
          </>
        )}

        {searching && (
          <>
            <Text style={styles.sectionTitle}>
              {results.length} result{results.length === 1 ? '' : 's'} for &quot;{query.trim()}&quot;
            </Text>
            {results.map((item) => (
              <MenuRow key={item.id} item={item} onDetail={setDetailItem} />
            ))}
          </>
        )}

        {tab === 'orders' && (
          <View>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>My Orders</Text>
              <Pressable onPress={() => loadOrders()}>
                <Text style={styles.seeAll}>{ordersLoading ? 'Refreshing…' : 'Refresh'}</Text>
              </Pressable>
            </View>
            <View style={styles.ordersTabs}>
              <Pressable
                style={[styles.chip, ordersTab === 'active' && styles.chipActive]}
                onPress={() => setOrdersTab('active')}>
                <Text style={[styles.chipText, ordersTab === 'active' && styles.chipTextActive]}>
                  Active ({activeOrders.length})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, ordersTab === 'past' && styles.chipActive]}
                onPress={() => setOrdersTab('past')}>
                <Text style={[styles.chipText, ordersTab === 'past' && styles.chipTextActive]}>
                  Delivered ({pastOrders.length})
                </Text>
              </Pressable>
            </View>
            {ordersLoading && paidOrders.length === 0 ? (
              <ActivityIndicator size="large" color={Brand.terracotta} style={styles.ordersLoader} />
            ) : shownOrders.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyGlyph}>{ordersTab === 'active' ? '🎉' : '◷'}</Text>
                <Text style={styles.emptyTitle}>
                  {paidOrders.length === 0
                    ? 'No orders yet'
                    : ordersTab === 'active'
                      ? 'No active orders'
                      : 'No delivered orders yet'}
                </Text>
                <Text style={styles.emptyText}>
                  {paidOrders.length === 0
                    ? 'Your delicious orders will appear here.'
                    : ordersTab === 'active'
                      ? 'Sab order deliver ho gaye — naya order karo!'
                      : 'Delivered orders yaha dikhenge.'}
                </Text>
                {paidOrders.length === 0 && (
                  <Pressable
                    style={styles.btn}
                    onPress={() => {
                      setQuery('');
                      switchTab('home');
                    }}>
                    <Text style={styles.btnText}>Browse menu</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              shownOrders.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))
            )}
          </View>
        )}

        {tab === 'profile' && (
          <View>
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{initial}</Text>
              </View>
              <Text style={styles.profileLabel}>Your name</Text>
              <TextInput
                value={profileName}
                onChangeText={setProfileName}
                placeholder="Your name"
                placeholderTextColor="#B4A69E"
                style={styles.profileNameInput}
                maxLength={100}
              />
              <View style={styles.verifiedRow}>
                <Text style={styles.profilePhone}>+91 {user?.phone ?? ''}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                </View>
              </View>
            </View>
            <View style={styles.profileRow}>
              <View style={styles.zoneHead}>
                <Text style={styles.profileRowTitle}>Delivery zone</Text>
                <Pressable onPress={() => void checkZone()} hitSlop={8}>
                  <Text style={styles.rowLink}>{zoneState === 'checking' ? 'Checking…' : 'Check again'}</Text>
                </Pressable>
              </View>
              <Text
                style={
                  zoneState === 'inside'
                    ? styles.zoneOk
                    : zoneState === 'outside'
                      ? styles.zoneBad
                      : styles.profileRowSub
                }>
                {zoneState === 'checking'
                  ? 'Checking your location…'
                  : zoneState === 'inside'
                    ? `📍 Within delivery area${zoneDist != null ? ` • ${zoneDist >= 1000 ? `${(zoneDist / 1000).toFixed(1)} km` : `${zoneDist} m`} from the shop` : ''} — you can order now!`
                    : zoneState === 'outside'
                      ? `You are ${zoneDist != null ? (zoneDist >= 1000 ? `${(zoneDist / 1000).toFixed(1)} km` : `${zoneDist} m`) : 'too far'} from the shop — please order when you are within ${radiusLabel(shopCfg.radiusM)}.`
                      : zoneState === 'denied'
                        ? 'Location is off — allow it in Settings, then tap Check.'
                        : 'Check whether the shop delivers to your location.'}
              </Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowTitle}>Default delivery address</Text>
              <TextInput
                value={profileAddr}
                onChangeText={setProfileAddr}
                placeholder="e.g. H.No 12, Lane 3, Near Sakshi Electronics"
                placeholderTextColor="#B4A69E"
                style={styles.profileAddrInput}
                multiline
              />
              <Text style={styles.addrHint}>
                Auto-filled at checkout. Delivery goes to your GPS location — this only helps the rider find you.
              </Text>
            </View>
            <Pressable
              style={[styles.btn, savingProfile && styles.btnDisabled]}
              onPress={() => void saveProfile()}
              disabled={savingProfile}>
              {savingProfile ? (
                <View style={styles.checkoutBusyRow}>
                  <ActivityIndicator size="small" color={Brand.white} />
                  <Text style={styles.btnText}>Saving…</Text>
                </View>
              ) : (
                <Text style={styles.btnText}>Save profile</Text>
              )}
            </Pressable>
            <Pressable style={[styles.profileRow, styles.ordersCard]} onPress={() => switchTab('orders')}>
              <View>
                <Text style={styles.profileRowTitle}>My orders</Text>
                <Text style={styles.profileRowSub}>
                  {orderCount === 0 ? 'No orders yet' : `${orderCount} order${orderCount === 1 ? '' : 's'} • ₹${orderSpent} paid`}
                </Text>
              </View>
              <Text style={styles.ordersArrow}>→</Text>
            </Pressable>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowTitle}>Food preference</Text>
              <Text style={styles.profileRowSub}>Pure Veg • Always on</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowTitle}>Order notifications</Text>
              <Text style={styles.profileRowSub}>
                {pushState === 'on' ? 'ON • you will receive status updates' : pushState === 'off' ? `OFF • ${pushReason}` : 'Checking…'}
              </Text>
            </View>
            {pushState === 'off' && (
              <Pressable style={[styles.btn, pushBusy && styles.btnDisabled]} onPress={enablePush} disabled={pushBusy}>
                <Text style={styles.btnText}>{pushBusy ? 'Trying…' : '🔔 Enable notifications'}</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.logoutBtn, loggingOut && styles.btnDisabled]}
              disabled={loggingOut}
              onPress={async () => {
                if (loggingOut) return;
                setLoggingOut(true);
                try {
                  // 1. Server pe token expire (8s timeout ke sath — hang nahi hoga).
                  await logout();
                } catch {
                  // logout() khud safe hai; phir bhi login pe bhejo.
                } finally {
                  // 2. Purane user ka cart/sheet sath me nahi jayega.
                  clear();
                  setCartOpen(false);
                  setQuery('');
                  setLoggingOut(false);
                  // 3. Login pe — replace fail ho to push fallback.
                  try {
                    router.replace('/auth');
                  } catch {
                    router.push('/auth');
                  }
                }
              }}>
              <Text style={styles.logoutText}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
            </Pressable>
            <Text style={styles.version}>Dev Ratna v1.0.0 • Made with care in Dehradun</Text>
          </View>
        )}
          </>
        )}
      </ScrollView>

      {/* Sticky cart bar */}
      {count > 0 && (tab === 'home' || tab === 'menu') && (
        <Pressable style={styles.cartBar} onPress={() => setCartOpen(true)}>
          <Text style={styles.cartBarText}>
            {count} item{count === 1 ? '' : 's'} • ₹{total}
          </Text>
          <Text style={styles.cartBarCta}>View Cart →</Text>
        </Pressable>
      )}

      {/* Bottom tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tabItem} onPress={() => switchTab(t.key)}>
            <SymbolView
              name={t.icon}
              size={24}
              weight="semibold"
              tintColor={tab === t.key ? Brand.terracotta : Brand.stone}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabActive]}>{t.label}</Text>
            {tab === t.key && <View style={styles.tabDot} />}
          </Pressable>
        ))}
      </View>

      {/* Cart sheet — locked while the order is being placed (see placingOrder) */}
      <Modal
        visible={cartOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!placingOrder) setCartOpen(false);
        }}>
        {/* Keyboard khulne pe sheet upar uthe — address box keyboard ke neeche na dabe. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
        <View style={styles.sheetBg}>
          {/* Backdrop sibling hai (parent nahi) — taaki ScrollView ke touch
              Pressable me na atke. Yehi scroll-stuck ka root cause tha. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!placingOrder) setCartOpen(false);
            }}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(28, insets.bottom + 20) },
              kbH > 0 ? { maxHeight: availH - 16 } : null,
            ]}>
            <View style={styles.sheetHandle} />
            {/* Poora body ek hi scroll me — list alag + bill alag scroll wali ladai khatam.
                Items kabhi address box ke peeche nahi dabenge, button hamesha pahunchega. */}
            <ScrollView
              ref={sheetBodyRef}
              style={[styles.sheetBody, { maxHeight: bodyMaxH }]}
              contentContainerStyle={styles.sheetBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              scrollEnabled
              scrollEventThrottle={16}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Your Cart</Text>
              <Pressable onPress={clear}>
                <Text style={styles.sheetClear}>Clear</Text>
              </Pressable>
            </View>
            <View style={styles.sheetList}>
              {lines.map(({ item, portion, qty, unit }) => (
                <View key={`${item.id}:${portion}`} style={styles.sheetLine}>
                  <View style={styles.sheetInfo}>
                    <VegMark />
                    <View>
                      <Text style={styles.sheetName} numberOfLines={1}>
                        {item.name}
                        {portion !== 'single' ? ` (${portionLabel(portion)})` : ''}
                      </Text>
                      <Text style={styles.sheetPrice}>
                        ₹{unit} × {qty} = ₹{unit * qty}
                      </Text>
                    </View>
                  </View>
                  <AddControl item={item} portion={portion} />
                </View>
              ))}
            </View>
            <View
              style={styles.addrBox}
              onLayout={(e) => {
                addrBoxY.current = e.nativeEvent.layout.y;
              }}>
              <Text style={styles.addrLabel}>Delivery address (house no. + landmark) *</Text>
              <TextInput
                ref={addrInputRef}
                value={address}
                onChangeText={setAddress}
                onFocus={() => {
                  // Keyboard aate hi address box tak scroll — dabega nahi.
                  const y = Math.max(0, addrBoxY.current - 12);
                  setTimeout(() => sheetBodyRef.current?.scrollTo({ y, animated: true }), 300);
                }}
                placeholder="e.g. H.No 12, Lane 3, Near Sakshi Electronics"
                placeholderTextColor="#B4A69E"
                style={styles.addrInput}
                multiline
              />
              <Text style={styles.addrHint}>
                Delivery is made only to your current GPS location — the address only helps the
                rider find your home.
              </Text>
            </View>
            <View style={styles.bill}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item total</Text>
                <Text style={styles.billValue}>₹{total}</Text>
              </View>
              {pickedOffer && (
                <View style={styles.offerStrip}>
                  <Text style={styles.offerStripText} numberOfLines={2}>
                    🎉 {pickedOffer.offer.name} applied{pickedOffer.freeItemName ? ` • ${pickedOffer.freeItemName} FREE` : ''}
                    {offerLeftMs != null ? ` • ⏳ ${formatTimer(offerLeftMs)}` : ''}
                  </Text>
                </View>
              )}
              {offerDiscount > 0 && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, styles.billFree]}>Offer discount</Text>
                  <Text style={[styles.billValue, styles.billFree]}>−₹{offerDiscount}</Text>
                </View>
              )}
              {pickedOffer?.freeItemName && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>{pickedOffer.freeItemName} × 1</Text>
                  <Text style={[styles.billValue, styles.billFree]}>FREE</Text>
                </View>
              )}
              {deliveryKnown && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery</Text>
                  <Text style={styles.billValue}>₹{deliveryFee}</Text>
                </View>
              )}
              {deliveryKnown && (
                <View style={[styles.billRow, styles.billTotal]}>
                  <Text style={styles.billTotalText}>To pay</Text>
                  <Text style={styles.billTotalText}>₹{payable}</Text>
                </View>
              )}
            </View>
            </ScrollView>
            {/* Fixed footer — location se pehle Get Location, uske baad Proceed. */}
            <View style={styles.sheetFoot}>
            <Text style={styles.gateHint}>
              {shopCfg.deliveryMode === 'distance'
                ? `Min food order ₹${shopCfg.minOrder} + delivery ₹${shopCfg.deliveryBase} se (distance ke hisab se) • Within ${radiusLabel(shopCfg.radiusM)} of the shop`
                : `Min food order ₹${shopCfg.minOrder} + ₹${shopCfg.deliveryCharge} delivery • Within ${radiusLabel(shopCfg.radiusM)} of the shop`}
            </Text>
            {!deliveryKnown ? (
              <Pressable
                style={[styles.btn, styles.checkoutBtn, locating && styles.btnDisabled]}
                onPress={fetchCartLocation}
                disabled={locating}>
                {locating ? (
                  <View style={styles.checkoutBusyRow}>
                    <ActivityIndicator size="small" color={Brand.white} />
                    <Text style={styles.btnText}>Fetching location…</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>📍 Get Your Location</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[styles.btn, styles.checkoutBtn, (validating || placingOrder) && styles.btnDisabled]}
                onPress={startCheckout}
                disabled={validating || placingOrder}>
                {(validating || placingOrder) ? (
                  <View style={styles.checkoutBusyRow}>
                    <ActivityIndicator size="small" color={Brand.white} />
                    <Text style={styles.btnText}>
                      {validating ? 'Checking… Please wait' : 'Placing your order…'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>
                    {`Proceed to Checkout • ₹${payable}`}
                  </Text>
                )}
              </Pressable>
            )}
            </View>
            {/* Placing lock — sirf delivery popup ke baad (GPS + place order) dikhega.
                Pehle click (validating) me sirf button loader, koi overlay nahi. */}
            {placingOrder && (
              <View style={styles.lockOverlay}>
                <ActivityIndicator size="large" color={Brand.cream} />
                <Text style={styles.lockText}>Placing your order…{'\n'}Please wait, don&apos;t press anything.</Text>
              </View>
            )}
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Razorpay payment sheet */}
      <RazorpayCheckout
        visible={rzpData !== null}
        data={rzpData}
        onSuccess={handleRzpSuccess}
        onCancel={handleRzpCancel}
        onError={handleRzpError}
      />

      {/* Sweet-alert style popup (replaces native Alert) */}
      <AppAlert data={alert} onClose={() => setAlert(null)} />

      {/* Zomato-style dish detail */}
      <DishDetailModal item={detailItem} onClose={() => setDetailItem(null)} />

      {/* Payment verification overlay */}
      <Modal visible={verifying} transparent animationType="fade">
        <View style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            <ActivityIndicator size="large" color={Brand.terracotta} />
            <Text style={styles.verifyText}>Confirming payment…</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  center: { flex: 1, backgroundColor: Brand.cream, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollBody: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: Brand.cream,
    borderBottomWidth: 1,
    borderBottomColor: Brand.bone,
  },
  chipsBar: { marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  locTitle: { fontSize: 19, color: Brand.espresso, fontFamily: Fonts.bodyExtra },
  locSub: { marginTop: 1, fontSize: 12.5, color: Brand.stone, fontFamily: Fonts.body },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pureVeg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#1E7A34',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pureVegDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1E7A34' },
  pureVegText: { fontSize: 10, letterSpacing: 1, color: '#1E7A34', fontFamily: Fonts.bodyExtra },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Brand.white, fontSize: 17, fontFamily: Fonts.display },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.bone,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    shadowColor: Brand.espresso,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: { fontSize: 18, color: Brand.terracotta, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: Brand.espresso, fontFamily: Fonts.body },
  offline: {
    marginTop: 10,
    fontSize: 12,
    color: Brand.stone,
    textAlign: 'center',
    fontFamily: Fonts.body,
  },
  closedBanner: {
    marginTop: 10,
    fontSize: 13,
    color: '#B3261E',
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    textAlign: 'center',
    fontFamily: Fonts.bodyBold,
    overflow: 'hidden',
  },
  unavail: { fontSize: 12, color: Brand.stone, fontFamily: Fonts.bodyBold },
  unavailTag: {
    marginTop: 4,
    fontSize: 11,
    color: '#B3261E',
    backgroundColor: '#FDECEA',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: Fonts.bodyBold,
    overflow: 'hidden',
  },
  banner: {
    marginTop: 14,
    marginRight: BANNER_GAP,
    borderWidth: 1,
    borderColor: 'rgba(36,26,23,0.08)',
    borderRadius: 18,
    padding: 18,
    height: 128,
    justifyContent: 'space-between',
  },
  bannerTitle: { fontSize: 21, fontFamily: Fonts.display },
  bannerText: { marginTop: 4, fontSize: 13, fontFamily: Fonts.body },
  bannerTimer: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bannerTimerText: { color: '#FFFFFF', fontSize: 12.5, fontFamily: Fonts.bodyBold, fontVariant: ['tabular-nums'] },
  bannerPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerPillText: { color: '#FFFFFF', fontSize: 12, fontFamily: Fonts.bodyBold },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.bone },
  dotActive: { width: 18, backgroundColor: Brand.terracotta },
  sectionTitle: { marginTop: 22, fontSize: 20, color: Brand.espresso, fontFamily: Fonts.display },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { marginTop: 22, fontSize: 13, color: Brand.terracotta, fontFamily: Fonts.bodyBold },
  catRow: { marginTop: 12 },
  catTile: { alignItems: 'center', width: 76, marginRight: 12 },
  catImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: Brand.clay },
  catMono: { backgroundColor: '#F3E3D3', alignItems: 'center', justifyContent: 'center' },
  catMonoText: { fontSize: 24, color: Brand.terracotta, fontFamily: Fonts.display },
  catLabel: { marginTop: 6, fontSize: 11, color: Brand.espresso, textAlign: 'center', fontFamily: Fonts.bodySemi },
  bestRow: { marginTop: 12 },
  bestCard: {
    width: 208,
    marginRight: 14,
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Brand.bone,
    overflow: 'hidden',
  },
  bestImg: { width: '100%', height: 152, backgroundColor: Brand.clay },
  bestMono: { backgroundColor: '#F3E3D3', alignItems: 'center', justifyContent: 'center' },
  bestMonoText: { fontSize: 40, color: Brand.terracotta, fontFamily: Fonts.display },
  bestBody: { padding: 12, gap: 6 },
  bestName: { fontSize: 15, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  bestMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bestRating: { fontSize: 12, color: '#1E7A34', fontFamily: Fonts.bodyBold },
  bestPrice: { fontSize: 14, color: Brand.espresso, fontFamily: Fonts.bodySemi },
  catHead: {
    marginTop: 18,
    fontSize: 13,
    letterSpacing: 1.5,
    color: Brand.terracotta,
    fontFamily: Fonts.bodyBold,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Brand.bone,
    gap: 14,
  },
  rowInfo: { flex: 1, gap: 5 },
  rowName: { fontSize: 16, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  rowPrice: { fontSize: 15, color: Brand.espresso, fontFamily: Fonts.bodySemi },
  rowDesc: { fontSize: 13, color: Brand.stone, lineHeight: 19, fontFamily: Fonts.body },
  rowAction: { justifyContent: 'flex-start', minWidth: 132, alignItems: 'center' },
  rowImg: { width: 132, height: 128, borderRadius: 16, backgroundColor: Brand.clay },
  rowAddWrap: { marginTop: -18, alignItems: 'center', gap: 4 },
  vegBox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#1E7A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E7A34' },
  mrp: { fontSize: 12, color: Brand.stone, fontFamily: Fonts.bodyBold },
  addBtn: {
    borderWidth: 1.5,
    borderColor: Brand.terracotta,
    backgroundColor: Brand.white,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  addText: { fontSize: 13, letterSpacing: 1, color: Brand.terracotta, fontFamily: Fonts.bodyExtra },
  selLabel: { fontSize: 11, color: Brand.terracotta, fontFamily: Fonts.bodyBold, textAlign: 'center', backgroundColor: Brand.white, paddingHorizontal: 8, borderRadius: 6 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(36,26,23,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  pickerCard: {
    width: '100%',
    backgroundColor: Brand.cream,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  pickerTitle: { fontSize: 17, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  pickerSub: { marginTop: -8, fontSize: 12.5, color: Brand.stone, fontFamily: Fonts.body },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.bone,
    borderRadius: 14,
    padding: 12,
  },
  pickerName: { fontSize: 14, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  pickerPrice: { marginTop: 2, fontSize: 13, color: Brand.stone, fontFamily: Fonts.bodySemi },
  pickerClose: {
    backgroundColor: Brand.espresso,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickerCloseText: { color: Brand.cream, fontSize: 14, fontFamily: Fonts.bodyBold },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.terracotta,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  stepText: { fontSize: 16, color: Brand.white, fontFamily: Fonts.bodyExtra },
  stepQty: { minWidth: 20, textAlign: 'center', fontSize: 14, color: Brand.white, fontFamily: Fonts.bodyExtra },
  chips: { marginTop: 12 },
  chip: {
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.bone,
  },
  chipActive: { backgroundColor: Brand.espresso, borderColor: Brand.espresso },
  chipText: { fontSize: 13, color: Brand.stone, fontFamily: Fonts.bodySemi },
  chipTextActive: { color: Brand.cream },
  dealCard: { marginTop: 18, borderRadius: 18, overflow: 'hidden', height: 196 },
  dealImg: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  dealScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(36,26,23,0.62)' },
  dealBody: { flex: 1, justifyContent: 'flex-end', padding: 16 },
  dealPill: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.gold,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dealPillText: { fontSize: 10, letterSpacing: 1.5, color: '#3A2A00', fontFamily: Fonts.bodyExtra },
  dealTitle: { marginTop: 8, fontSize: 24, color: Brand.cream, fontFamily: Fonts.display },
  dealText: {
    marginTop: 2,
    fontSize: 13,
    color: 'rgba(255,248,238,0.85)',
    fontFamily: Fonts.body,
  },
  dealRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dealPrice: { fontSize: 19, color: Brand.cream, fontFamily: Fonts.bodyExtra },
  dealBtn: { backgroundColor: Brand.cream, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  dealBtnText: { fontSize: 13, color: Brand.espresso, fontFamily: Fonts.bodyExtra },
  pocketCard: {
    width: 168,
    marginRight: 14,
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Brand.bone,
    padding: 10,
    gap: 7,
  },
  pocketTile: {
    height: 118,
    borderRadius: 14,
    backgroundColor: '#F3E3D3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pocketImg: { height: 118, borderRadius: 14, width: '100%', backgroundColor: Brand.clay },
  pocketLetter: { fontSize: 32, color: Brand.terracotta, fontFamily: Fonts.display },
  pocketName: { fontSize: 14, color: Brand.espresso, fontFamily: Fonts.bodyBold, minHeight: 36 },
  pocketPrice: { fontSize: 14, color: Brand.espresso, fontFamily: Fonts.bodySemi },
  sectionSub: { marginTop: 2, fontSize: 13, color: Brand.stone, fontFamily: Fonts.body },
  visitCard: {
    marginTop: 12,
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Brand.bone,
    padding: 16,
    gap: 10,
  },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visitStars: { fontSize: 15, color: '#1E7A34', fontFamily: Fonts.bodyExtra, minWidth: 44 },
  visitGlyph: { fontSize: 16, color: Brand.terracotta, minWidth: 44, textAlign: 'center' },
  visitText: { flex: 1, fontSize: 14, color: Brand.espresso, fontFamily: Fonts.body },
  visitBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  visitBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Brand.terracotta,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  visitBtnDark: { backgroundColor: Brand.espresso, borderColor: Brand.espresso },
  visitBtnText: { fontSize: 14, color: Brand.terracotta, fontFamily: Fonts.bodyBold },
  visitBtnDarkText: { color: Brand.cream },
  moreBtn: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: Brand.terracotta,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  moreBtnText: { fontSize: 14, color: Brand.terracotta, fontFamily: Fonts.bodyBold },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Brand.espresso,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  cartBarText: { fontSize: 14, color: Brand.cream, fontFamily: Fonts.bodyBold },
  cartBarCta: { fontSize: 14, color: Brand.gold, fontFamily: Fonts.bodyExtra },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderTopWidth: 1,
    borderTopColor: Brand.bone,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { width: 24, height: 24 },
  tabLabel: { fontSize: 11, color: Brand.stone, fontFamily: Fonts.bodySemi },
  tabActive: { color: Brand.terracotta },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Brand.terracotta, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 70, gap: 8 },
  emptyGlyph: { fontSize: 56, color: Brand.bone },
  emptyTitle: { fontSize: 20, color: Brand.espresso, fontFamily: Fonts.display },
  emptyText: { fontSize: 14, color: Brand.stone, fontFamily: Fonts.body },
  ordersLoader: { marginTop: 60 },
  ordersTabs: { flexDirection: 'row', marginTop: 12 },
  orderCard: {
    marginTop: 14,
    backgroundColor: Brand.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.bone,
    overflow: 'hidden',
    shadowColor: Brand.espresso,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ordHeader: {
    backgroundColor: Brand.espresso,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ordHeadLeft: { flex: 1 },
  ordIdBig: { fontSize: 21, color: Brand.cream, fontFamily: Fonts.display },
  ordDateLight: { marginTop: 2, fontSize: 12, color: '#D5C3BD', fontFamily: Fonts.body },
  ordHeadRight: { alignItems: 'flex-end', gap: 6 },
  ordTotalBig: { fontSize: 24, color: Brand.gold, fontFamily: Fonts.bodyExtra },
  ordStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 9 },
  ordPulse: { width: 9, height: 9, borderRadius: 5 },
  ordStripText: { flex: 1, fontSize: 13, fontFamily: Fonts.bodyExtra },
  ordBody: { padding: 16, gap: 10 },
  ordItems: { gap: 10, marginTop: 2 },
  ordItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyChip: {
    minWidth: 44, alignItems: 'center',
    backgroundColor: Brand.creamRich, borderWidth: 1, borderColor: Brand.bone,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
  },
  qtyText: { fontSize: 12.5, color: Brand.terracotta, fontFamily: Fonts.bodyExtra },
  ordItemName: { flex: 1, fontSize: 14, lineHeight: 19, color: Brand.espresso, fontFamily: Fonts.bodyMed },
  ordItemAmt: { fontSize: 14.5, color: Brand.espresso, fontFamily: Fonts.bodyExtra },
  receipt: {
    marginTop: 4, backgroundColor: Brand.creamRich,
    borderWidth: 1, borderColor: Brand.bone, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, gap: 6,
  },
  receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  receiptLbl: { fontSize: 13, color: Brand.stone, fontFamily: Fonts.body },
  receiptVal: { fontSize: 13.5, color: Brand.espresso, fontFamily: Fonts.bodySemi },
  receiptTotal: { borderTopWidth: 1, borderTopColor: Brand.bone, borderStyle: 'dashed', paddingTop: 8, marginTop: 2 },
  orderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId: { fontSize: 17, color: Brand.espresso, fontFamily: Fonts.bodyExtra },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 12, letterSpacing: 0.5, fontFamily: Fonts.bodyExtra },
  orderDate: { fontSize: 12.5, color: Brand.stone, fontFamily: Fonts.body },
  orderAddr: { fontSize: 12.5, lineHeight: 18, color: Brand.stone, fontFamily: Fonts.body },
  orderFailReason: { fontSize: 12.5, lineHeight: 18, color: '#B3261E', fontFamily: Fonts.body },
  orderLines: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Brand.bone,
    paddingTop: 10,
    gap: 5,
  },
  orderLine: { fontSize: 13.5, color: Brand.espresso, fontFamily: Fonts.body },
  orderTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Brand.bone,
    paddingTop: 10,
  },
  orderCount: { marginTop: 8, fontSize: 12, color: Brand.stone, fontFamily: Fonts.bodyBold },
  billSplit: { marginTop: 10, borderTopWidth: 1, borderTopColor: Brand.bone, paddingTop: 10, gap: 4 },
  billSplitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billSplitLabel: { fontSize: 13, color: Brand.stone, fontFamily: Fonts.body },
  billSplitValue: { fontSize: 13.5, color: Brand.espresso, fontFamily: Fonts.bodySemi },
  billSplitTotal: { marginTop: 4, borderTopWidth: 1, borderTopColor: Brand.bone, paddingTop: 8 },
  track: { flexDirection: 'row', marginTop: 14, paddingHorizontal: 2 },
  trackStep: { flex: 1, alignItems: 'center', position: 'relative' },
  trackDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Brand.white, borderWidth: 2, borderColor: Brand.bone,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  trackDone: { backgroundColor: '#1E7A34', borderColor: '#1E7A34' },
  trackCurrent: { borderColor: Brand.gold, borderWidth: 3, shadowColor: Brand.gold, shadowOpacity: 0.5, shadowRadius: 6 },
  trackTick: { color: Brand.white, fontSize: 13, fontWeight: '800' },
  trackLabel: { marginTop: 5, fontSize: 10, color: Brand.stone, fontFamily: Fonts.bodySemi, textAlign: 'center' },
  trackLabelDone: { color: Brand.espresso },
  trackLine: { position: 'absolute', top: 12, left: '55%', right: '-45%', height: 2, backgroundColor: Brand.bone },
  trackLineDone: { backgroundColor: '#1E7A34' },
  orderTotalLabel: { fontSize: 13, color: Brand.stone, fontFamily: Fonts.bodySemi },
  orderTotalValue: { fontSize: 18, color: Brand.terracotta, fontFamily: Fonts.bodyExtra },
  profileCard: { marginTop: 8, alignItems: 'center', gap: 4 },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Brand.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Brand.gold,
  },
  profileAvatarText: { fontSize: 30, color: Brand.white, fontFamily: Fonts.display },
  profileName: { marginTop: 8, fontSize: 22, color: Brand.espresso, fontFamily: Fonts.display },
  profilePhone: { fontSize: 14, color: Brand.stone, fontFamily: Fonts.body },
  profileRow: {
    marginTop: 12,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.bone,
    borderRadius: 14,
    padding: 14,
  },
  profileRowTitle: { fontSize: 11, letterSpacing: 1.5, color: Brand.stone, fontFamily: Fonts.bodyBold },
  profileRowSub: { marginTop: 4, fontSize: 15, color: Brand.espresso, fontFamily: Fonts.bodySemi },
  profileLabel: { marginTop: 10, fontSize: 11, letterSpacing: 1.5, color: Brand.stone, fontFamily: Fonts.bodyBold },
  profileNameInput: {
    marginTop: 6,
    width: '100%',
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 17,
    color: Brand.espresso,
    fontFamily: Fonts.bodySemi,
    textAlign: 'center',
  },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  verifiedBadge: { backgroundColor: '#E6F4EA', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  verifiedText: { fontSize: 11, color: '#1E7A34', fontFamily: Fonts.bodyExtra },
  profileAddrInput: {
    marginTop: 8,
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
    fontSize: 14,
    color: Brand.espresso,
    fontFamily: Fonts.body,
    textAlignVertical: 'top',
  },
  zoneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLink: { fontSize: 13, color: Brand.terracotta, fontFamily: Fonts.bodyBold },
  zoneOk: { marginTop: 4, fontSize: 14, lineHeight: 20, color: '#1E7A34', fontFamily: Fonts.bodySemi },
  zoneBad: { marginTop: 4, fontSize: 14, lineHeight: 20, color: '#B3261E', fontFamily: Fonts.bodySemi },
  ordersCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ordersArrow: { fontSize: 22, color: Brand.terracotta, fontFamily: Fonts.bodyExtra },
  logoutBtn: {
    marginTop: 16,
    backgroundColor: Brand.espresso,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: Brand.cream, fontSize: 15, letterSpacing: 1, fontFamily: Fonts.bodyExtra },
  version: { marginTop: 14, marginBottom: 8, textAlign: 'center', fontSize: 12, color: Brand.stone, fontFamily: Fonts.body },
  btn: {
    marginTop: 16,
    backgroundColor: Brand.terracotta,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  btnText: { color: Brand.white, fontSize: 15, fontFamily: Fonts.bodyBold },
  btnDisabled: { opacity: 0.85 },
  checkoutBtn: { minHeight: 52, justifyContent: 'center' },
  checkoutBusyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gateHint: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: Brand.stone,
    fontFamily: Fonts.body,
  },
  verifyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(36,26,23,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyCard: {
    backgroundColor: Brand.cream,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  verifyText: { fontSize: 15, color: Brand.espresso, fontFamily: Fonts.bodySemi },
  sheetBg: { flex: 1, backgroundColor: 'rgba(36,26,23,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Brand.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Brand.bone,
    marginBottom: 12,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 22, color: Brand.espresso, fontFamily: Fonts.display },
  sheetClear: { fontSize: 13, color: Brand.terracotta, fontFamily: Fonts.bodyBold },
  // Single scroll body — pixel cap deterministic hai, isliye kabhi overlap nahi.
  sheetBody: { flexGrow: 0, maxHeight: SHEET_BODY_MAX_H },
  sheetBodyContent: { paddingBottom: 4 },
  // Fixed footer — hint + Proceed button hamesha dikhenge, scroll nahi honge.
  sheetFoot: { paddingTop: 10 },
  sheetList: { marginTop: 8 },
  sheetLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Brand.bone,
    gap: 10,
  },
  sheetInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetName: { fontSize: 14, color: Brand.espresso, fontFamily: Fonts.bodySemi, maxWidth: 170 },
  sheetPrice: { marginTop: 2, fontSize: 12.5, color: Brand.stone, fontFamily: Fonts.body },
  addrBox: { marginTop: 12, gap: 6 },
  addrLabel: { fontSize: 12, letterSpacing: 1, color: Brand.stone, fontFamily: Fonts.bodyBold },
  addrInput: {
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    // Multiline bina cap ke sheet ko dhakka deta tha (upar-neeche bounce) — ab 4 line pe scroll.
    maxHeight: 110,
    fontSize: 14,
    color: Brand.espresso,
    fontFamily: Fonts.body,
    textAlignVertical: 'top',
  },
  addrHint: { fontSize: 12, lineHeight: 17, color: Brand.stone, fontFamily: Fonts.body },
  bill: { marginTop: 12, gap: 6 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between' },
  offerStrip: {
    backgroundColor: '#E9F5EC',
    borderWidth: 1,
    borderColor: '#BCD5C2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  offerStripText: { fontSize: 13, color: '#1E4D2B', fontFamily: Fonts.bodyBold },
  billLabel: { fontSize: 13.5, color: Brand.stone, fontFamily: Fonts.body },
  billValue: { fontSize: 13.5, color: Brand.espresso, fontFamily: Fonts.bodySemi },
  billFree: { fontSize: 13.5, color: '#1E7A34', fontFamily: Fonts.bodyBold },
  billTotal: { borderTopWidth: 1, borderTopColor: Brand.bone, paddingTop: 8, marginTop: 4 },
  billTotalText: { fontSize: 16, color: Brand.espresso, fontFamily: Fonts.bodyExtra },
  detailBg: { flex: 1, backgroundColor: 'rgba(36,26,23,0.55)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: Brand.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 16,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  detailImg: { width: '100%', height: 260, borderRadius: 20, backgroundColor: Brand.clay, marginTop: 8 },
  detailBody: { marginTop: 14, gap: 6 },
  detailName: { fontSize: 23, color: Brand.espresso, fontFamily: Fonts.display },
  detailPrice: { fontSize: 18, color: Brand.terracotta, fontFamily: Fonts.bodyExtra },
  detailDesc: { fontSize: 14, lineHeight: 21, color: Brand.stone, fontFamily: Fonts.body },
  detailBest: { fontSize: 12.5, color: '#1E7A34', fontFamily: Fonts.bodyBold },
  detailCta: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailClose: {
    flex: 1,
    backgroundColor: Brand.espresso,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailCloseText: { color: Brand.cream, fontSize: 14, fontFamily: Fonts.bodyBold },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(36,26,23,0.6)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  lockText: { color: Brand.cream, fontSize: 15, textAlign: 'center', lineHeight: 22, fontFamily: Fonts.bodySemi },
});
