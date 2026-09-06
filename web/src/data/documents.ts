import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

/** Mirrors `toPublicDocument` in the backend's document service. */
export interface Document {
  id: string;
  filename: string;
  byteSize: number;
  chunkCount: number;
  status: "processing" | "ready" | "failed";
  error: string | null;
  createdAt: string;
}

const documentsKey = ["documents"] as const;

export const useDocuments = () => {
  return useQuery({
    queryKey: documentsKey,
    queryFn: async () => {
      const { documents } = await api.get<{ documents: Document[] }>(
        "/api/documents",
      );
      return documents;
    },
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      // The field name the backend's `upload.single("file")` expects.
      form.append("file", file);
      const { document } = await api.upload<{ document: Document }>(
        "/api/documents",
        form,
      );
      return document;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentsKey }),
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentsKey }),
  });
};
