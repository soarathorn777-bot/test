import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";

/** Mirrors `toPublicUpload` in the backend's CGM service. */
export interface CgmUpload {
  id: string;
  filename: string;
  byteSize: number;
  status: "processing" | "ready" | "failed";
  error: string | null;
  /** Readings the workbook held, and how many of them were not already stored. */
  rowCount: number;
  insertedCount: number;
  createdAt: string;
}

/** Mirrors `toPublicReading`. `comment` is the only user-owned field. */
export interface CgmReading {
  id: string;
  mgDl: number;
  /** Device wall clock, `YYYY-MM-DDTHH:MM:SS`. See lib/wallClock.ts. */
  timeStamp: string;
  comment: string;
}

export interface ReadingsPage {
  readings: CgmReading[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageParams {
  page: number;
  pageSize: number;
  order: "asc" | "desc";
}

const uploadsKey = ["cgm", "uploads"] as const;
const readingsKey = ["cgm", "readings"] as const;

/**
 * Ingest runs in the background, so the list polls itself while anything is
 * still parsing and falls quiet once everything has settled.
 */
export const useCgmUploads = () =>
  useQuery({
    queryKey: uploadsKey,
    queryFn: async () => {
      const { uploads } = await api.get<{ uploads: CgmUpload[] }>("/api/cgm/uploads");
      return uploads;
    },
    refetchInterval: (query) =>
      query.state.data?.some((upload) => upload.status === "processing") ? 2000 : false,
  });

export const useCgmReadings = (params: PageParams) =>
  useQuery({
    queryKey: [...readingsKey, params] as const,
    queryFn: () =>
      api.get<ReadingsPage>(
        `/api/cgm/readings?page=${params.page}&pageSize=${params.pageSize}&order=${params.order}`,
      ),
    // Holding the previous page on screen while the next one loads keeps the
    // chart from collapsing to a skeleton on every page step.
    placeholderData: (previous) => previous,
  });

export const useUploadWorkbook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      // The field name the backend's `upload.single("file")` expects.
      form.append("file", file);
      const { upload } = await api.upload<{ upload: CgmUpload }>("/api/cgm/uploads", form);
      return upload;
    },
    // Only the upload list is refreshed here: the readings do not exist yet.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: uploadsKey }),
  });
};

export const useDeleteCgmUpload = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/cgm/uploads/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cgm"] }),
  });
};

export const useUpdateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; comment: string }) => {
      const { reading } = await api.patch<{ reading: CgmReading }>(
        `/api/cgm/readings/${params.id}`,
        { comment: params.comment },
      );
      return reading;
    },
    // Patch the saved row into every cached page rather than refetching: the
    // user is still typing in the table and a refetch would fight the input.
    onSuccess: (reading) => {
      queryClient.setQueriesData<ReadingsPage>({ queryKey: readingsKey }, (page) =>
        page
          ? {
              ...page,
              readings: page.readings.map((row) => (row.id === reading.id ? reading : row)),
            }
          : page,
      );
    },
  });
};

/** Fires the n8n workflow; it emails the result rather than returning it here. */
export const useAnalyzeReading = () =>
  useMutation({
    mutationFn: (id: string) => api.post<{ status: "sent" }>(`/api/cgm/readings/${id}/analyze`),
  });

/**
 * Readings appear some seconds after the upload request returns, so the table
 * is refreshed on the edge where the last ingest finishes -- watching the list
 * the uploads panel is already polling.
 */
export const useRefreshWhenIngestSettles = (uploads: CgmUpload[] | undefined) => {
  const queryClient = useQueryClient();
  const wasProcessing = useRef(false);

  useEffect(() => {
    const processing = uploads?.some((upload) => upload.status === "processing") ?? false;
    if (wasProcessing.current && !processing) {
      queryClient.invalidateQueries({ queryKey: readingsKey });
    }
    wasProcessing.current = processing;
  }, [uploads, queryClient]);
};
