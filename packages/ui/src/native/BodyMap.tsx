/**
 * BodyMap (native) — the React Native / react-native-svg twin of
 * `../web/BodyMap`. Draws the exact same figure from the shared
 * `../bodyMap/regions` model so a placement selected on mobile is identical to
 * one selected on web.
 *
 * Controlled via `value` + `onChange`. Each region is an accessible,
 * pressable SVG shape (role button, label "Left forearm", selected state); a
 * plain tappable option list below the figure is the fallback for
 * tap-precision / assistive tech.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Rect } from "react-native-svg";
import { cx } from "../cx";
import {
  FIGURES,
  placementLabel,
  placementSelectOptions,
  decodeOption,
  samePlacement,
  type PlacementValue,
  type PlacementView,
  type RegionShape,
  type Shape,
} from "../bodyMap/regions";

export interface BodyMapProps {
  value: PlacementValue | null;
  onChange: (value: PlacementValue) => void;
  /** Show the tappable option list beneath the map. Default true. */
  showFallback?: boolean;
  className?: string;
}

const PALETTE = {
  base: { fill: "rgba(250,250,250,0.05)", stroke: "rgba(250,250,250,0.16)" },
  selected: { fill: "#7C3AED", stroke: "#C4B5FD" },
};

function ShapeEl({
  rs,
  selected,
  onSelect,
}: {
  rs: RegionShape;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = selected ? PALETTE.selected : PALETTE.base;
  const shape: Shape = rs.shape;
  const common = {
    onPress: onSelect,
    fill: tone.fill,
    stroke: tone.stroke,
    strokeWidth: selected ? 2 : 1.5,
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: placementLabel(rs),
    accessibilityState: { selected },
  };
  switch (shape.kind) {
    case "circle":
      return <Circle cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
    case "ellipse":
      return <Ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />;
    case "rrect":
      return (
        <Rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          {...common}
        />
      );
  }
}

function ViewToggle({
  view,
  onChange,
}: {
  view: PlacementView;
  onChange: (v: PlacementView) => void;
}) {
  return (
    <View className="flex-row self-start rounded-full border border-border-subtle bg-surface-raised p-1">
      {(["front", "back"] as const).map((v) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === v }}
          className={cx("rounded-full px-4 py-1.5", view === v && "bg-brand")}
        >
          <Text
            className={cx(
              "text-sm font-semibold capitalize",
              view === v ? "text-brand-on" : "text-content-secondary",
            )}
          >
            {v}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function BodyMap({ value, onChange, showFallback = true, className }: BodyMapProps) {
  const [view, setView] = useState<PlacementView>(value?.view ?? "front");
  const figure = FIGURES[view];
  const selectedLabel = value ? placementLabel(value, { withView: value.view }) : null;
  const options = placementSelectOptions(view);

  return (
    <View className={cx("gap-4", className)}>
      <View className="flex-row items-center justify-between gap-3">
        <ViewToggle view={view} onChange={setView} />
        <Text
          accessibilityLiveRegion="polite"
          className={cx(
            "text-right text-sm",
            selectedLabel ? "font-semibold text-content-primary" : "text-content-muted",
          )}
        >
          {selectedLabel ?? "No placement yet"}
        </Text>
      </View>

      <View className="w-full items-center">
        <View style={{ width: "70%", aspectRatio: figure.viewBox.w / figure.viewBox.h }}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${figure.viewBox.w} ${figure.viewBox.h}`}
            accessibilityRole="image"
            accessibilityLabel="Tattoo placement — tap a region of the body"
          >
            {figure.regions.map((rs) => {
              const isSel =
                !!value && samePlacement(value, { region: rs.region, side: rs.side, view });
              return (
                <ShapeEl
                  key={`${rs.region}:${rs.side ?? "-"}`}
                  rs={rs}
                  selected={isSel}
                  onSelect={() => onChange({ region: rs.region, side: rs.side, view })}
                />
              );
            })}
          </Svg>
        </View>
      </View>

      {showFallback && (
        <View className="gap-2">
          <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
            Or pick from a list
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pr-2"
          >
            {options.map((o) => {
              const decoded = decodeOption(o.value, view);
              const isSel =
                !!value && !!decoded && samePlacement(value, decoded) && value.view === view;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => decoded && onChange(decoded)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  className={cx(
                    "rounded-full border px-3 py-1.5",
                    isSel ? "border-brand bg-brand" : "border-border-subtle bg-surface-raised",
                  )}
                >
                  <Text
                    className={cx(
                      "text-sm",
                      isSel ? "text-brand-on" : "text-content-secondary",
                    )}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/**
 * BodyMapThumbnail — compact, non-interactive figure with one region
 * highlighted, for artist-side placement display.
 */
export function BodyMapThumbnail({
  value,
  size = 96,
}: {
  value: PlacementValue;
  size?: number;
}) {
  const figure = FIGURES[value.view];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Placement: ${placementLabel(value, { withView: value.view })}`}
      style={{ width: size, aspectRatio: figure.viewBox.w / figure.viewBox.h }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${figure.viewBox.w} ${figure.viewBox.h}`}>
        {figure.regions.map((rs) => {
          const isSel = samePlacement(value, {
            region: rs.region,
            side: rs.side,
            view: value.view,
          });
          const tone = isSel ? PALETTE.selected : PALETTE.base;
          const shape = rs.shape;
          const common = { fill: tone.fill, stroke: tone.stroke, strokeWidth: isSel ? 2 : 1 };
          const key = `${rs.region}:${rs.side ?? "-"}`;
          if (shape.kind === "circle")
            return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
          if (shape.kind === "ellipse")
            return (
              <Ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />
            );
          return (
            <Rect
              key={key}
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              rx={shape.rx}
              {...common}
            />
          );
        })}
      </Svg>
    </View>
  );
}
