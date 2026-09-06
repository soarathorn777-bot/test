import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCgmReadings,
  useCgmUploads,
  useRefreshWhenIngestSettles,
  type PageParams,
} from "../../../data/cgm";
import { errorMessage } from "../../../lib/api";
import { ReadingsChart } from "./-components/ReadingsChart";
import { ReadingsTable } from "./-components/ReadingsTable";
import { Uploads } from "./-components/Uploads";

const PAGE_SIZES = [100, 200, 500, 1000];
const DEFAULTS = { page: 1, pageSize: 200, order: "asc" as const };

export const Route = createFileRoute("/_authed/cgm/")({
  validateSearch: (search: Record<string, unknown>): Partial<PageParams> => {
    const page = Number(search.page);
    const pageSize = Number(search.pageSize);
    return {
      ...(Number.isInteger(page) && page > 1 ? { page } : {}),
      ...(PAGE_SIZES.includes(pageSize) && pageSize !== DEFAULTS.pageSize
        ? { pageSize }
        : {}),
      ...(search.order === "desc" ? { order: "desc" as const } : {}),
    };
  },
  component: CgmPage,
});

function CgmPage() {
  const search = Route.useSearch();
  const params: PageParams = { ...DEFAULTS, ...search };
  const navigate = useNavigate({ from: Route.fullPath });

  const uploads = useCgmUploads();
  useRefreshWhenIngestSettles(uploads.data);

  const readings = useCgmReadings(params);
  const data = readings.data;

  // Clamp rather than error: deleting an upload can strand the URL past the end.
  const page = data ? Math.min(params.page, data.totalPages) : params.page;
  const goTo = (next: Partial<PageParams>) => {
    const merged = { ...params, ...next };
    // Only non-default values reach the URL.
    navigate({
      search: {
        ...(merged.page > DEFAULTS.page ? { page: merged.page } : {}),
        ...(merged.pageSize !== DEFAULTS.pageSize
          ? { pageSize: merged.pageSize }
          : {}),
        ...(merged.order !== DEFAULTS.order ? { order: merged.order } : {}),
      },
    });
  };

  const first = data ? (page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(page * data.pageSize, data.total) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_21rem] lg:items-start">
      <div className="grid gap-5">
        <div className="card grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h1 className="card-title mb-0">Glucose</h1>
              <p className="m-0 text-sm font-normal text-gray-500 dark:text-gray-400">
                {data && data.total > 0
                  ? `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${data.total.toLocaleString()} readings`
                  : "No readings yet"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Per page
                <select
                  className="input w-auto px-2 py-1.5 text-sm"
                  value={params.pageSize}
                  onChange={(e) =>
                    goTo({ pageSize: Number(e.target.value), page: 1 })
                  }
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button-ghost px-3 py-1.5 text-sm"
                onClick={() =>
                  goTo({
                    order: params.order === "asc" ? "desc" : "asc",
                    page: 1,
                  })
                }
              >
                {params.order === "asc" ? "Oldest first" : "Newest first"}
              </button>
            </div>
          </div>

          {readings.error ? (
            <p className="alert">{errorMessage(readings.error)}</p>
          ) : data ? (
            <div
              style={{
                opacity: readings.isPlaceholderData ? 0.55 : 1,
                transition: "opacity 120ms",
              }}
            >
              <ReadingsChart readings={data.readings} />
            </div>
          ) : (
            <p className="py-16 text-center font-normal text-gray-500 dark:text-gray-400">
              Loading readings...
            </p>
          )}

          {data && data.total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                className="button-ghost px-3 py-1.5 text-sm"
                disabled={page <= 1}
                onClick={() => goTo({ page: page - 1 })}
              >
                &larr; Previous
              </button>
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                Page {page.toLocaleString()} of{" "}
                {data.totalPages.toLocaleString()}
              </span>
              <button
                className="button-ghost px-3 py-1.5 text-sm"
                disabled={page >= data.totalPages}
                onClick={() => goTo({ page: page + 1 })}
              >
                Next &rarr;
              </button>
            </div>
          ) : null}
        </div>

        {data && data.readings.length > 0 ? (
          <div
            className="card grid gap-3"
            style={{
              opacity: readings.isPlaceholderData ? 0.55 : 1,
              transition: "opacity 120ms",
            }}
          >
            <div>
              <h2 className="card-subtitle">Readings</h2>
              <p className="m-0 text-sm font-normal text-gray-500 dark:text-gray-400">
                Comments are yours — they are never read from the file and a
                re-upload leaves them alone.
              </p>
            </div>
            <ReadingsTable readings={data.readings} />
          </div>
        ) : null}
      </div>

      <Uploads />
    </div>
  );
}
