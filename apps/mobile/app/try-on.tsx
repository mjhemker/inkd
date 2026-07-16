import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type ViewStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { Button, Eyebrow, Icon, Slider, Toggle } from "@inkd/ui/native";
import {
  DEFAULT_TRYON_TRANSFORM,
  TRYON_DISCLAIMER,
  TRYON_LOCAL_ONLY_MOBILE,
  TRYON_PLACARD_LABEL,
  TRYON_TAGLINE,
  TRYON_TITLE,
  TRYON_LIMITS,
  TRYON_WRAP_STRIPS_MOBILE,
  cylindricalWarpStrips,
  type WarpStrip,
} from "@inkd/core";

const SURFACE_BASE = "#0A0A0B";
const SURFACE_RAISED = "#111113";
const BORDER = "#1A1A1D";
const CONTENT_MUTED = "#71717A";
const EMBER = "#F0662E";
const INK = "#FAFAFA";

/** Local, on-device gesture transform (px offsets; scale/rotation absolute). */
interface Xf {
  tx: number;
  ty: number;
  scale: number;
  rotation: number;
  opacity: number;
  /** Total cylindrical wrap angle in degrees — see TryOnTransform.wrap in @inkd/core. */
  wrap: number;
  inkBlend: boolean;
}

const INITIAL: Xf = {
  tx: 0,
  ty: 0,
  scale: 1,
  rotation: 0,
  opacity: DEFAULT_TRYON_TRANSFORM.opacity,
  wrap: DEFAULT_TRYON_TRANSFORM.wrap,
  inkBlend: true,
};

function clampScale(s: number) {
  return Math.min(Math.max(s, TRYON_LIMITS.scaleMin), TRYON_LIMITS.scaleMax);
}
function dist(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}
function angleDeg(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) {
  return (Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * 180) / Math.PI;
}

/**
 * Fit a `srcW`×`srcH` image inside a `boxW`×`boxH` box, letterboxed/centered
 * (same behavior as RN's `resizeMode="contain"`) — needed so the wrap strips'
 * source-pixel fractions line up with where the design is actually rendered,
 * not the full (possibly non-square) box.
 */
function containFit(srcW: number, srcH: number, boxW: number, boxH: number) {
  if (srcW <= 0 || srcH <= 0 || boxW <= 0 || boxH <= 0) {
    return { width: boxW, height: boxH, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return { width, height, offsetX: (boxW - width) / 2, offsetY: (boxH - height) / 2 };
}

/**
 * Mobile fit check — the basic, on-device version of the web `/try-on` editor.
 * Pick a body photo + a design, drag / pinch / rotate it into place, tune
 * opacity + ink blend, flip before/after, and share a stamped composite. A
 * placement preview — never a prediction, never AR, nothing uploaded.
 */
export default function TryOnScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ design?: string }>();

  const [bodyUri, setBodyUri] = useState<string | null>(null);
  const [designUri, setDesignUri] = useState<string | null>(
    typeof params.design === "string" && params.design ? params.design : null,
  );
  const [t, setT] = useState<Xf>(INITIAL);
  const [showBefore, setShowBefore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [designSize, setDesignSize] = useState<{ w: number; h: number } | null>(null);

  // Real history-back so a "Try it on" launched from a post's sheet lands
  // back on that same post — Expo Router keeps the previous screen mounted
  // underneath, so its state (an open post sheet) survives this navigation.
  // Falls back to the feed tab when there's no history (e.g. a deep link
  // opened this screen directly).
  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as never);
  }, [router]);

  // Cylindrical wrap needs the design's own pixel aspect ratio to line strip
  // fractions up with where `resizeMode="contain"` actually renders it.
  useEffect(() => {
    if (!designUri) {
      setDesignSize(null);
      return;
    }
    let alive = true;
    Image.getSize(
      designUri,
      (w, h) => {
        if (alive) setDesignSize({ w, h });
      },
      () => {
        if (alive) setDesignSize(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [designUri]);

  const stageRef = useRef<View>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const gestureRef = useRef<{
    mode: "none" | "pan" | "pinch";
    lastX: number;
    lastY: number;
    startDist: number;
    startAngle: number;
    startScale: number;
    startRot: number;
  }>({ mode: "none", lastX: 0, lastY: 0, startDist: 0, startAngle: 0, startScale: 1, startRot: 0 });

  const activeRef = useRef({ hasDesign: false, before: false });
  activeRef.current = { hasDesign: designUri != null, before: showBefore };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => activeRef.current.hasDesign && !activeRef.current.before,
      onMoveShouldSetPanResponder: () => activeRef.current.hasDesign && !activeRef.current.before,
      onPanResponderGrant: () => {
        gestureRef.current.mode = "none";
      },
      onPanResponderMove: (evt: GestureResponderEvent, _gs: PanResponderGestureState) => {
        const touches = evt.nativeEvent.touches;
        const g = gestureRef.current;
        if (touches.length >= 2) {
          const a = touches[0];
          const b = touches[1];
          if (!a || !b) return;
          if (g.mode !== "pinch") {
            g.mode = "pinch";
            g.startDist = dist(a, b) || 1;
            g.startAngle = angleDeg(a, b);
            g.startScale = tRef.current.scale;
            g.startRot = tRef.current.rotation;
          }
          const scale = clampScale(g.startScale * (dist(a, b) / g.startDist));
          const rotation = g.startRot + (angleDeg(a, b) - g.startAngle);
          setT((prev) => ({ ...prev, scale, rotation }));
        } else if (touches.length === 1) {
          const p = touches[0];
          if (!p) return;
          if (g.mode !== "pan") {
            g.mode = "pan";
            g.lastX = p.pageX;
            g.lastY = p.pageY;
          } else {
            const dx = p.pageX - g.lastX;
            const dy = p.pageY - g.lastY;
            g.lastX = p.pageX;
            g.lastY = p.pageY;
            setT((prev) => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
          }
        }
      },
      onPanResponderRelease: () => {
        gestureRef.current.mode = "none";
      },
      onPanResponderTerminate: () => {
        gestureRef.current.mode = "none";
      },
    }),
  ).current;

  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ w: width, h: height });
  }, []);

  const pick = useCallback(async (target: "body" | "design") => {
    setNote(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setNote("Photo access is off — enable it in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    if (target === "body") setBodyUri(uri);
    else {
      setDesignUri(uri);
      setT(INITIAL);
    }
  }, []);

  const onShare = useCallback(async () => {
    if (!bodyUri || !stageRef.current) return;
    setBusy(true);
    setNote(null);
    try {
      const uri = await captureRef(stageRef, { format: "png", quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Save or share your fit check",
        });
      } else {
        setNote("Sharing isn't available here — take a screenshot instead.");
      }
    } catch {
      setNote("Couldn't build the image. Take a screenshot of the preview instead.");
    } finally {
      setBusy(false);
    }
  }, [bodyUri]);

  const box = stage.w > 0 ? Math.min(stage.w, stage.h) * 0.5 : 160;

  // Cylindrical wrap strips — only recomputed when the wrap slider or the
  // design's own aspect ratio changes, never on drag/pinch/rotate (those
  // only touch the outer wrapper's transform below). Mobile has no
  // canvas/Skia image-warp primitive available in this app, so it uses a
  // coarser strip count (TRYON_WRAP_STRIPS_MOBILE) built from plain
  // absolutely-positioned, cropped <Image> slices rather than web's 80-strip
  // offscreen-canvas remap.
  const wrapStrips: WarpStrip[] | null = useMemo(
    () => (t.wrap > 0 ? cylindricalWarpStrips(TRYON_WRAP_STRIPS_MOBILE, t.wrap) : null),
    [t.wrap],
  );
  const designFit = useMemo(
    () => (designSize ? containFit(designSize.w, designSize.h, box, box) : null),
    [designSize, box],
  );

  const designStyle: ViewStyle = {
    position: "absolute",
    width: box,
    height: box,
    left: stage.w / 2 - box / 2,
    top: stage.h / 2 - box / 2,
    opacity: t.opacity,
    transform: [
      { translateX: t.tx },
      { translateY: t.ty },
      { scale: t.scale },
      { rotate: `${t.rotation}deg` },
    ],
    // mixBlendMode ships in RN 0.80+ (New Architecture). Sinks ink into skin.
    ...(t.inkBlend ? { mixBlendMode: "multiply" as ViewStyle["mixBlendMode"] } : {}),
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={10}>
          <Icon name="chevron-left" size={24} color={INK} />
        </Pressable>
        <Text style={styles.topTitle}>{TRYON_TITLE}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.introWrap}>
          <Eyebrow>INKD · placement preview</Eyebrow>
          <Text style={styles.tagline}>{TRYON_TAGLINE}</Text>
          <View style={styles.localRow}>
            <Icon name="shield" size={13} color={CONTENT_MUTED} />
            <Text style={styles.localNote}>{TRYON_LOCAL_ONLY_MOBILE}</Text>
          </View>
        </View>

        {/* Stage (captured for export, placard included) */}
        <View style={styles.stageOuter}>
          <View
            ref={stageRef}
            collapsable={false}
            style={styles.stage}
            onLayout={onStageLayout}
            {...panResponder.panHandlers}
          >
            {bodyUri ? (
              <Image source={{ uri: bodyUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.stageEmpty}>
                <Icon name="image" size={28} color={CONTENT_MUTED} />
                <Text style={styles.stageEmptyTitle}>Add a body photo</Text>
                <Text style={styles.stageEmptyText}>A clear, flat shot of the spot.</Text>
              </View>
            )}

            {bodyUri && designUri && !showBefore ? (
              <View style={designStyle}>
                {wrapStrips && designFit ? (
                  wrapStrips.map((strip) => (
                    <WrapStripView
                      key={strip.index}
                      strip={strip}
                      designUri={designUri}
                      fit={designFit}
                    />
                  ))
                ) : (
                  <Image
                    source={{ uri: designUri }}
                    style={styles.designImage}
                    resizeMode="contain"
                  />
                )}
              </View>
            ) : null}

            {/* Stamped placard — part of the capture */}
            {bodyUri ? (
              <View style={styles.placard}>
                <View style={styles.placardEmber} />
                <Text style={styles.placardText} numberOfLines={1}>
                  {TRYON_PLACARD_LABEL}
                </Text>
              </View>
            ) : null}

            {showBefore ? (
              <View style={styles.beforeTag}>
                <Text style={styles.beforeTagText}>BEFORE</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Source pickers */}
        <View style={styles.pickRow}>
          <PickTile
            label={bodyUri ? "Change photo" : "Body photo"}
            icon="user"
            filled={bodyUri != null}
            onPress={() => void pick("body")}
          />
          <PickTile
            label={designUri ? "Change design" : "Design"}
            icon="sparkles"
            filled={designUri != null}
            onPress={() => void pick("design")}
          />
        </View>

        {/* Controls */}
        <View style={[styles.controls, (!bodyUri || !designUri) && { opacity: 0.45 }]}>
          <Slider
            label="Size"
            value={t.scale}
            onValueChange={(v) => setT((p) => ({ ...p, scale: v }))}
            min={TRYON_LIMITS.scaleMin}
            max={TRYON_LIMITS.scaleMax}
            step={0.01}
            disabled={!bodyUri || !designUri}
          />
          <Slider
            label="Rotate"
            value={t.rotation}
            onValueChange={(v) => setT((p) => ({ ...p, rotation: v }))}
            min={TRYON_LIMITS.rotationMin}
            max={TRYON_LIMITS.rotationMax}
            step={1}
            disabled={!bodyUri || !designUri}
          />
          <Slider
            label="Wrap (limb curve)"
            value={t.wrap}
            onValueChange={(v) => setT((p) => ({ ...p, wrap: v }))}
            min={TRYON_LIMITS.wrapMin}
            max={TRYON_LIMITS.wrapMax}
            step={1}
            disabled={!bodyUri || !designUri}
          />
          <Slider
            label="Opacity"
            value={t.opacity}
            onValueChange={(v) => setT((p) => ({ ...p, opacity: v }))}
            min={TRYON_LIMITS.opacityMin}
            max={TRYON_LIMITS.opacityMax}
            step={0.01}
            disabled={!bodyUri || !designUri}
          />
          <Toggle
            checked={t.inkBlend}
            onCheckedChange={(v) => setT((p) => ({ ...p, inkBlend: v }))}
            label="Ink blend (multiply)"
          />
          <Text style={styles.hint}>
            Drag to move · pinch to size · twist to rotate. Wrap curves it
            around the limb. Ink blend sinks the design into the skin; on very
            dark skin, turn it off and use opacity.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!designUri}
            onPress={() => setShowBefore((v) => !v)}
          >
            {showBefore ? "After" : "Before"}
          </Button>
          <Button className="flex-1" disabled={!bodyUri || busy} loading={busy} onPress={() => void onShare()}>
            Share fit check
          </Button>
        </View>

        {note ? <Text style={styles.errNote}>{note}</Text> : null}

        {/* Honesty rail */}
        <View style={styles.disclaimer}>
          <Icon name="shield" size={15} color={CONTENT_MUTED} />
          <Text style={styles.disclaimerText}>{TRYON_DISCLAIMER}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PickTile({
  label,
  icon,
  filled,
  onPress,
}: {
  label: string;
  icon: "user" | "sparkles";
  filled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pickTile, filled && styles.pickTileFilled]}>
      <Icon name={icon} size={18} color={filled ? EMBER : INK} />
      <Text style={styles.pickTileLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * One cylindrical-wrap strip: a clipped container sized/positioned per
 * `strip.xStart/width` (within the rendered, letterboxed design area), with
 * the full design `<Image>` shifted left by `strip.uStart` so only that
 * slice shows through — the RN equivalent of the web canvas's per-strip
 * `drawImage(sx, sw, ... dx, dw)` crop. `strip.opacity` fades the outermost
 * sliver of a strong wrap; the black overlay approximates the brightness
 * falloff (no true multiply-per-strip primitive without a canvas/Skia).
 */
function WrapStripView({
  strip,
  designUri,
  fit,
}: {
  strip: WarpStrip;
  designUri: string;
  fit: { width: number; height: number; offsetX: number; offsetY: number };
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: fit.offsetX + strip.xStart * fit.width,
        top: fit.offsetY,
        width: Math.max(1, strip.width * fit.width + 1),
        height: fit.height,
        overflow: "hidden",
        opacity: strip.opacity,
      }}
    >
      <Image
        source={{ uri: designUri }}
        resizeMode="stretch"
        style={{
          position: "absolute",
          left: -strip.uStart * fit.width,
          top: 0,
          width: fit.width,
          height: fit.height,
        }}
      />
      {strip.brightness < 1 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "#000",
            opacity: 1 - strip.brightness,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE_BASE },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  topTitle: { color: INK, fontSize: 16, fontWeight: "700" },
  introWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 6 },
  tagline: { color: EMBER, fontSize: 20, fontFamily: "Caveat_700Bold", lineHeight: 24 },
  localRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  localNote: { color: CONTENT_MUTED, fontSize: 12 },
  stageOuter: { paddingHorizontal: 16, paddingTop: 14 },
  stage: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_RAISED,
  },
  designImage: { width: "100%", height: "100%" },
  stageEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 20 },
  stageEmptyTitle: { color: INK, fontSize: 16, fontWeight: "700", marginTop: 4 },
  stageEmptyText: { color: CONTENT_MUTED, fontSize: 13, textAlign: "center" },
  placard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,10,11,0.86)",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  placardEmber: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: EMBER },
  placardText: { color: INK, fontSize: 10, fontFamily: "JetBrainsMono_500Medium", letterSpacing: 0.3 },
  beforeTag: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(10,10,11,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  beforeTagText: { color: INK, fontSize: 10, fontFamily: "JetBrainsMono_500Medium", letterSpacing: 1 },
  pickRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  pickTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_RAISED,
  },
  pickTileFilled: { borderColor: EMBER },
  pickTileLabel: { color: INK, fontSize: 13, fontWeight: "600" },
  controls: { paddingHorizontal: 16, paddingTop: 18, gap: 16 },
  hint: { color: CONTENT_MUTED, fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 18 },
  errNote: { color: "#F87171", fontSize: 13, paddingHorizontal: 16, paddingTop: 12 },
  disclaimer: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 18,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_RAISED,
  },
  disclaimerText: { color: "#A1A1AA", fontSize: 12, lineHeight: 17, flex: 1 },
});
