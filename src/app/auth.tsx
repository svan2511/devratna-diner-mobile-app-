import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Brand, Fonts } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

type Step = 'phone' | 'otp';

function isValidPhone(p: string): boolean {
  return /^[6-9]\d{9}$/.test(p);
}

/**
 * Single-screen auth: phone number -> 6-box OTP (+ name on first visit).
 * Light premium restaurant styling: warm cream canvas, dark readable text,
 * Marcellus wordmark + Outfit UI, terracotta CTA.
 */
export default function AuthScreen() {
  const router = useRouter();
  const { token, ready, dummyMode, requestOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [name, setName] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [cooldown, setCooldown] = useState(0);
  const [validLeft, setValidLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boxRefs = useRef<Array<TextInput | null>>([]);
  const verifyingRef = useRef(false);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeX = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  function triggerShake() {
    shakeX.value = withSequence(
      withTiming(12, { duration: 55 }),
      withTiming(-12, { duration: 55 }),
      withTiming(9, { duration: 55 }),
      withTiming(-9, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
  }

  useEffect(() => {
    if (ready && token) router.replace('/home');
  }, [ready, token, router]);

  // One ticker drives both the resend cooldown and the OTP validity countdown.
  useEffect(() => {
    if (step !== 'otp') return;
    ticker.current = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
      setValidLeft((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => {
      if (ticker.current) clearInterval(ticker.current);
    };
  }, [step]);

  // When the validity window ends, kill the old code on the client too.
  useEffect(() => {
    if (step !== 'otp' || validLeft > 0) return;
    setDigits(Array(OTP_LENGTH).fill(''));
    boxRefs.current.forEach((b) => b?.blur());
    verifyingRef.current = false;
    setDevOtp(undefined);
    setError('This code has expired. Tap "Resend code" for a new one.');
  }, [step, validLeft]);

  function formatTime(sec: number): string {
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  }

  async function handleRequestOtp() {
    setError(null);
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (!isValidPhone(clean)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await requestOtp(clean);
      setPhone(clean);
      setDevOtp(res.devOtp);
      setDigits(Array(OTP_LENGTH).fill(''));
      verifyingRef.current = false;
      setStep('otp');
      setCooldown(RESEND_SECONDS);
      setValidLeft(res.expiresIn);
      setTimeout(() => boxRefs.current[0]?.focus(), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(code?: string) {
    const finalCode = (code ?? digits.join('')).trim();
    if (!/^\d{4}$/.test(finalCode)) {
      setError('Please enter the complete OTP.');
      return;
    }
    if (validLeft <= 0) {
      setError('This code has expired. Tap "Resend code" for a new one.');
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, finalCode, name.trim() ? name.trim() : undefined);
      router.replace('/home');
    } catch (e) {
      verifyingRef.current = false;
      setError(e instanceof Error ? e.message : 'Verification failed.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  function onDigitChange(index: number, value: string) {
    if (error) setError(null);
    const clean = value.replace(/\D/g, '');
    const next = [...digits];
    if (clean.length === 0) {
      next[index] = '';
      setDigits(next);
      return;
    }
    clean
      .slice(0, OTP_LENGTH - index)
      .split('')
      .forEach((c, i) => {
        next[index + i] = c;
      });
    setDigits(next);
    if (next.every((d) => d !== '')) {
      boxRefs.current[OTP_LENGTH - 1]?.blur();
      setTimeout(() => handleVerify(next.join('')), 350);
    } else {
      const firstEmpty = next.findIndex((d) => d === '');
      boxRefs.current[firstEmpty]?.focus();
    }
  }

  function onDigitKeyPress(index: number, key: string) {
    if (key === 'Backspace' && digits[index] === '' && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      boxRefs.current[index - 1]?.focus();
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View pointerEvents="none" style={styles.decor}>
          <View style={styles.glowTop} />
          <View style={styles.glowBottom} />
        </View>

        <View style={styles.wrap}>
          <View style={styles.brand}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.eyebrow}>Clement Town • Dehradun</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.steps}>
              <Text style={[styles.step, step === 'phone' && styles.stepActive]}>
                01 — Phone
              </Text>
              <View style={styles.stepBar} />
              <Text style={[styles.step, step === 'otp' && styles.stepActive]}>
                02 — Verify
              </Text>
            </View>

            {step === 'otp' && <Text style={styles.cardTitle}>Enter your code</Text>}
            <Text style={styles.cardSub}>
              {step === 'phone'
                ? 'Log in or create your account with your mobile number.'
                : `We sent a 4-digit code to +91 ${phone}.`}
            </Text>

            {step === 'phone' ? (
              <>
                <Text style={styles.label}>Mobile number</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.codeBadge}>
                    <View style={styles.flag}>
                      <View style={styles.flagSaffron} />
                      <View style={styles.flagWhite}>
                        <View style={styles.flagChakra} />
                      </View>
                      <View style={styles.flagGreen} />
                    </View>
                    <Text style={styles.codeText}>+91</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98970 12345"
                    placeholderTextColor="#B4A69E"
                    keyboardType="number-pad"
                    maxLength={10}
                    style={styles.phoneInput}
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleRequestOtp}
                  />
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                  onPress={handleRequestOtp}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={Brand.white} />
                  ) : (
                    <Text style={styles.btnText}>Send OTP</Text>
                  )}
                </Pressable>

                <Text style={styles.terms}>
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.label}>Verification code</Text>
                <Animated.View style={[styles.boxes, shakeStyle]}>
                  {digits.map((d, i) => (
                    <TextInput
                      key={i}
                      ref={(r) => {
                        boxRefs.current[i] = r;
                      }}
                      value={d}
                      onChangeText={(v) => onDigitChange(i, v)}
                      onKeyPress={({ nativeEvent }) => onDigitKeyPress(i, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={6}
                      selectTextOnFocus
                      style={[styles.box, d !== '' && styles.boxFilled, error && styles.boxError]}
                      editable={!loading}
                    />
                  ))}
                </Animated.View>
                <Text style={[styles.expiry, validLeft <= 30 && styles.expiryUrgent]}>
                  {validLeft > 0
                    ? `Code expires in ${formatTime(validLeft)}`
                    : 'Code expired — request a new one'}
                </Text>

                <Text style={styles.label}>Your name (first visit)</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Aarav Sharma"
                  placeholderTextColor="#B4A69E"
                  style={styles.nameInput}
                  maxLength={100}
                  editable={!loading}
                  autoCapitalize="words"
                />

                {devOtp ? (
                  <View style={styles.devBox}>
                    <Text style={styles.devTitle}>Development code: {devOtp}</Text>
                    <Text style={styles.devSub}>
                      Shown because the SMS provider is not connected yet.
                    </Text>
                  </View>
                ) : null}
                {dummyMode && !devOtp ? (
                  <Text style={styles.hint}>
                    The server is unreachable — demo mode is on (use 1234).
                  </Text>
                ) : null}

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                  onPress={() => handleVerify()}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={Brand.white} />
                  ) : (
                    <Text style={styles.btnText}>Verify & Continue</Text>
                  )}
                </Pressable>

                <View style={styles.row}>
                  <Pressable onPress={() => setStep('phone')} disabled={loading}>
                    <Text style={styles.link}>Change number</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => cooldown === 0 && handleRequestOtp()}
                    disabled={loading || cooldown > 0}>
                    <Text style={[styles.link, cooldown > 0 && styles.linkDim]}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          <Text style={styles.trust}>
            <Text style={styles.trustGreen}>● </Text>
            Pure Veg • 4.9 Rated • Clement Town
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cream },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  decor: { ...StyleSheet.absoluteFill },
  glowTop: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: Brand.gold,
    opacity: 0.08,
    top: -130,
    right: -110,
  },
  glowBottom: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Brand.terracotta,
    opacity: 0.07,
    bottom: -120,
    left: -100,
  },
  wrap: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  brand: { alignItems: 'center', paddingTop: 52 },
  logo: {
    width: 128,
    height: 128,
    shadowColor: Brand.espresso,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  eyebrow: {
    marginTop: 18,
    fontSize: 11,
    letterSpacing: 3.5,
    color: Brand.terracotta,
    fontFamily: Fonts.bodyBold,
  },
  card: {
    marginTop: 26,
    backgroundColor: Brand.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Brand.bone,
    shadowColor: Brand.espresso,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  step: { fontSize: 11, letterSpacing: 2, color: '#B4A69E', fontFamily: Fonts.bodyBold },
  stepActive: { color: Brand.espresso },
  stepBar: { flex: 1, height: 1, backgroundColor: Brand.bone, marginHorizontal: 10, borderRadius: 1 },
  cardTitle: { fontSize: 25, color: Brand.espresso, fontFamily: Fonts.display },
  cardSub: {
    marginTop: 6,
    fontSize: 14,
    color: Brand.stone,
    lineHeight: 21,
    fontFamily: Fonts.body,
  },
  label: {
    marginTop: 18,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Brand.stone,
    fontFamily: Fonts.bodyBold,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 10,
    backgroundColor: Brand.creamRich,
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 16,
    padding: 5,
    height: 62,
  },
  codeBadge: {
    backgroundColor: Brand.espresso,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  flag: {
    width: 24,
    height: 17,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  flagSaffron: { flex: 1, backgroundColor: '#FF9933' },
  flagWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagChakra: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#06038D' },
  flagGreen: { flex: 1, backgroundColor: '#138808' },
  codeText: { color: Brand.cream, fontSize: 16, fontFamily: Fonts.bodyExtra },
  phoneInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 21,
    letterSpacing: 1.5,
    color: Brand.espresso,
    fontFamily: Fonts.bodySemi,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  box: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: Brand.creamRich,
    borderWidth: 1.5,
    borderColor: Brand.bone,
    textAlign: 'center',
    fontSize: 22,
    color: Brand.espresso,
    fontFamily: Fonts.bodyExtra,
  },
  boxFilled: { borderColor: Brand.gold, backgroundColor: '#FFFBF2' },
  boxError: { borderColor: Brand.terracotta },
  expiry: {
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
    color: Brand.terracotta,
    fontFamily: Fonts.bodySemi,
  },
  expiryUrgent: { color: '#B3261E' },
  nameInput: {
    marginTop: 10,
    backgroundColor: Brand.creamRich,
    borderWidth: 1.5,
    borderColor: Brand.bone,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    fontSize: 16,
    color: Brand.espresso,
    fontFamily: Fonts.body,
  },
  devBox: {
    marginTop: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.gold,
    backgroundColor: '#FFFBF2',
    borderRadius: 14,
    padding: 12,
  },
  devTitle: {
    textAlign: 'center',
    fontSize: 15,
    color: Brand.terracotta,
    fontFamily: Fonts.bodyBold,
  },
  devSub: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 12,
    color: Brand.stone,
    fontFamily: Fonts.body,
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: Brand.stone,
    textAlign: 'center',
    fontFamily: Fonts.body,
  },
  errorBox: {
    marginTop: 14,
    backgroundColor: '#FDECEA',
    borderLeftWidth: 4,
    borderLeftColor: '#B3261E',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#7A1F1A',
    textAlign: 'center',
    fontFamily: Fonts.bodySemi,
  },
  btn: {
    marginTop: 20,
    height: 56,
    borderRadius: 16,
    backgroundColor: Brand.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.terracotta,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  btnText: { color: Brand.white, fontSize: 15, letterSpacing: 1.5, fontFamily: Fonts.bodyExtra },
  terms: {
    marginTop: 14,
    fontSize: 12,
    color: Brand.stone,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: Fonts.body,
  },
  row: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' },
  link: { fontSize: 14, color: Brand.terracotta, fontFamily: Fonts.bodyBold },
  linkDim: { color: '#B4A69E' },
  trust: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 11,
    letterSpacing: 2,
    color: Brand.stone,
    textAlign: 'center',
    fontFamily: Fonts.bodySemi,
  },
  trustGreen: { color: '#1E7A34' },
});
