import { defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { scaleTime } from "d3-scale";
import { useMemo } from "react";
import type { CgmReading } from "../../../../data/cgm";
import { parseWallClock } from "../../../../lib/wallClock";

/**
 * The current page of readings, plotted with TanStack Charts.
 *
 * x is a d3 `scaleTime` rather than a compact point scale so a gap in the
 * sensor's record occupies its real width instead of closing up.
 */

interface Props {
  readings: CgmReading[];
}

interface Point {
  id: string;
  at: Date;
  mgDl: number;
  comment: string;
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const ReadingsChart = ({ readings }: Props) => {
  // The definition captures the rows, so it is memoized against them: its
  // identity is what tells the chart host the data changed.
  const definition = useMemo(() => {
    // The chart always reads left to right, whichever way the table is sorted.
    const points: Point[] = readings
      .map((reading) => ({
        id: reading.id,
        at: parseWallClock(reading.timeStamp),
        mgDl: reading.mgDl,
        comment: reading.comment,
      }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    return defineChart({
      marks: [lineY(points, { x: "at", y: "mgDl", key: "id" })],
      scales: {
        x: {
          scale: scaleTime,
          axis: { ticks: { format: (value) => timeFormat.format(value as Date) } },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: { label: "mg/dL" },
        },
      },
      // The default tooltip prints dates as UTC ISO, which would stamp a "Z"
      // onto a clock that never had a zone. These rows format it instead, and
      // surface the user's own comment when the reading has one.
      tooltip: {
        use: tooltip,
        items: [
          { id: "at", label: "Time", text: (point) => timeFormat.format(point.datum.at) },
          { channel: "y", label: "mg/dL", text: (point) => String(point.datum.mgDl) },
          { id: "comment", label: "Comment", text: (point) => point.datum.comment || null },
        ],
      },
    });
  }, [readings]);

  if (readings.length === 0) {
    return (
      <p className="py-16 text-center font-normal text-gray-500 dark:text-gray-400">
        No readings on this page.
      </p>
    );
  }

  return (
    // The library paints from `currentColor` and CSS variables, so the card's
    // own text colour carries it through light and dark with no second theme.
    <div className="text-gray-500 [--ts-chart-1:#2a78d6] dark:text-gray-400 dark:[--ts-chart-1:#3987e5]">
      <Chart
        definition={definition}
        height={300}
        ariaLabel={`Glucose for ${readings.length} readings on this page`}
      />
    </div>
  );
};
