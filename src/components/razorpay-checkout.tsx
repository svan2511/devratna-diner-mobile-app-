import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Brand, Fonts } from '@/constants/brand';

export type RazorpayCheckoutData = {
  key_id: string;
  order_id: string;
  amount: number; // paise
  currency: string;
  name?: string;
  phone?: string;
};

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

function buildHtml(data: RazorpayCheckoutData): string {
  // JSON-encode every dynamic value so user input can never break the page.
  const opts = JSON.stringify({
    key: data.key_id,
    amount: data.amount,
    currency: data.currency,
    order_id: data.order_id,
    name: 'Dev Ratna Diner',
    description: 'Food order',
    theme: { color: '#C65D3A' },
    prefill: { name: data.name ?? '', contact: data.phone ?? '' },
  }).replace(/</g, '\\u003c');
  const payLabel = JSON.stringify(`Pay ₹${(data.amount / 100).toFixed(0)}`).replace(/</g, '\\u003c');

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" />
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FFF8EE;font-family:sans-serif}
button{background:#C65D3A;color:#fff;border:0;border-radius:12px;padding:14px 28px;font-size:16px;font-weight:700}</style>
</head><body><button id="pay">…</button>
<script>
document.getElementById('pay').textContent = ${payLabel};
function post(o){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
try {
  var options = ${opts};
  options.modal = { ondismiss: function(){ post({ event: 'cancel' }); } };
  options.handler = function(r){ post({ event: 'success', razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature }); };
  var rzp = new Razorpay(options);
  rzp.on('payment.failed', function(r){ post({ event: 'error', message: (r.error && r.error.description) || 'Payment failed', code: (r.error && r.error.code) || undefined }); });
  document.getElementById('pay').onclick = function(){ rzp.open(); };
  rzp.open();
} catch (e) { post({ event: 'error', message: 'Could not load the payment page. Check your internet.' }); }
<\/script></body></html>`;
}

/**
 * Full-screen secure-payment sheet hosting Razorpay Checkout.
 * Works in Expo Go (no native SDK / dev build needed).
 */
export function RazorpayCheckout({
  visible,
  data,
  onSuccess,
  onCancel,
  onError,
}: {
  visible: boolean;
  data: RazorpayCheckoutData | null;
  onSuccess: (p: RazorpaySuccess) => void;
  onCancel: () => void;
  onError: (message: string, code?: string) => void;
}) {
  const html = useMemo(() => (data ? buildHtml(data) : ''), [data]);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as
        | { event: 'success'; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
        | { event: 'cancel' }
        | { event: 'error'; message?: string; code?: string };
      if (msg.event === 'success') {
        onSuccess({
          razorpay_order_id: msg.razorpay_order_id,
          razorpay_payment_id: msg.razorpay_payment_id,
          razorpay_signature: msg.razorpay_signature,
        });
      } else if (msg.event === 'cancel') {
        onCancel();
      } else {
        onError(msg.message || 'Payment failed.', msg.code);
      }
    } catch {
      onError('Could not read the payment result.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={s.root}>
        <View style={s.head}>
          <Text style={s.headTitle}>Secure payment</Text>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={s.headClose}>✕ Close</Text>
          </Pressable>
        </View>
        {data ? (
          <WebView
            source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
            onMessage={handleMessage}
            startInLoadingState
            style={s.web}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: Brand.bone,
  },
  headTitle: { fontSize: 17, color: Brand.espresso, fontFamily: Fonts.bodyBold },
  headClose: { fontSize: 14, color: Brand.terracotta, fontFamily: Fonts.bodyBold },
  web: { flex: 1, backgroundColor: Brand.cream },
});
