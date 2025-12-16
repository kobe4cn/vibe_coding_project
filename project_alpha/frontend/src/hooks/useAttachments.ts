import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attachmentApi } from '@/api/attachments';

export function useAttachments(ticketId: string) {
  return useQuery({
    queryKey: ['attachments', ticketId],
    queryFn: () => attachmentApi.list(ticketId),
    enabled: !!ticketId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, file }: { ticketId: string; file: File }) =>
      attachmentApi.upload(ticketId, file),
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', ticketId] });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; ticketId: string }) =>
      attachmentApi.delete(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.ticketId] });
    },
  });
}

