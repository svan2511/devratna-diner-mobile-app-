import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand, Fonts } from '@/constants/brand';

export type AppAlertType = 'success' | 'error' | 'warning' | 'info';

export type AppAlertAction = {
  text: string;
  onPress: () => void;
  /** Primary = filled brand button, otherwise outline button. */
  primary?: boolean;
};

export type AppAlertData = {
  title: string;
  message: string;
  type?: AppAlertType;
  buttonText?: string;
  /** When provided, these choice buttons render instead of the single OK button. */
  actions?: AppAlertAction[];
};

const TYPE_STYLE: Record<AppAlertType, { bg: string; glyph: string }> = {
  success: { bg: '#1E7A34', glyph: '✓' },
  error: { bg: '#B3261E', glyph: '!' },
  warning: { bg: Brand.terracotta, glyph: '!' },
  info: { bg: Brand.espresso, glyph: 'i' },
};

/**
 * Sweet-alert style popup — brand-matched replacement for native Alert.alert.
 * Warm cream card, colored icon badge, single OK button or custom choice buttons.
 */
export function AppAlert({
  data,
  onClose,
}: {
  data: AppAlertData | null;
  onClose: () => void;
}) {
  const type = data?.type ?? 'info';
  const tone = TYPE_STYLE[type];
  return (
    <Modal visible={data !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={styles.badgeGlyph}>{tone.glyph}</Text>
          </View>
          <Text style={styles.title}>{data?.title ?? ''}</Text>
          <Text style={styles.message}>{data?.message ?? ''}</Text>
          {data?.actions ? (
            <View style={styles.actions}>
              {data.actions.map((a) => (
                <Pressable
                  key={a.text}
                  style={[styles.actionBtn, a.primary ? { backgroundColor: tone.bg } : styles.actionBtnOutline]}
                  onPress={a.onPress}>
                  <Text style={[styles.btnText, !a.primary && styles.actionBtnOutlineText]}>{a.text}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable style={[styles.btn, { backgroundColor: tone.bg }]} onPress={onClose}>
              <Text style={styles.btnText}>{data?.buttonText ?? 'OK, got it'}</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(36,26,23,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Brand.cream,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.bone,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -52,
    borderWidth: 4,
    borderColor: Brand.cream,
  },
  badgeGlyph: {
    fontSize: 26,
    color: Brand.white,
    fontFamily: Fonts.bodyExtra,
  },
  title: {
    marginTop: 12,
    fontSize: 20,
    color: Brand.espresso,
    textAlign: 'center',
    fontFamily: Fonts.display,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: Brand.stone,
    textAlign: 'center',
    fontFamily: Fonts.body,
  },
  btn: {
    marginTop: 18,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  btnText: {
    color: Brand.white,
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: Fonts.bodyExtra,
  },
  actions: {
    marginTop: 18,
    width: '100%',
    gap: 10,
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Brand.bone,
  },
  actionBtnOutlineText: {
    color: Brand.espresso,
  },
});
