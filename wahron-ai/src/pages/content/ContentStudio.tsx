import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Archive, Copy, Sparkles, Video } from 'lucide-react'

import { useAppSelector } from '../../app/hooks'
import {
  useGenerateCaptionsMutation,
  useGetContentDraftsQuery,
  useSaveContentDraftMutation,
  useUpdateContentDraftMutation,
} from '../../features/content/contentApi'
import { useGetBusinessesQuery } from '../../features/business/businessApi'
import type {
  CaptionVariant,
  ContentDraft,
  ContentTone,
} from '../../features/content/contentTypes'

const toneOptions: Array<{ value: ContentTone; label: string }> = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'playful', label: 'Playful' },
  { value: 'professional', label: 'Professional' },
  { value: 'inspiring', label: 'Inspiring' },
]

export default function ContentStudio() {
  const workspace = useAppSelector(
    (state) => state.workspace.currentWorkspace,
  )
  const [businessId, setBusinessId] = useState('')
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState<ContentTone>('friendly')
  const [callToAction, setCallToAction] = useState('')
  const [variants, setVariants] = useState<CaptionVariant[]>([])
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [draftCaptions, setDraftCaptions] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')

  const {
    data: businesses,
    isError: businessesError,
    isLoading: businessesLoading,
  } = useGetBusinessesQuery(workspace?.id ?? '', {
    skip: !workspace,
  })

  const selectedBusinessId = businessId || businesses?.[0]?.id || ''
  const { data: drafts, isError: draftsError, isLoading: draftsLoading } =
    useGetContentDraftsQuery(
      {
        workspaceId: workspace?.id ?? '',
        businessId: selectedBusinessId,
      },
      { skip: !workspace || !selectedBusinessId },
    )

  const [generateCaptions, generationState] = useGenerateCaptionsMutation()
  const [saveContentDraft, saveState] = useSaveContentDraftMutation()
  const [updateContentDraft, updateState] = useUpdateContentDraftMutation()

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!workspace || !selectedBusinessId) return

    setNotice('')
    const result = await generateCaptions({
      workspaceId: workspace.id,
      body: {
        business_id: selectedBusinessId,
        topic: topic.trim(),
        audience: audience.trim() || undefined,
        tone,
        call_to_action: callToAction.trim() || undefined,
      },
    })

    if ('data' in result) {
      setVariants(result.data.variants)
      setSelectedVariant(0)
    }
  }

  const handleSave = async () => {
    const variant = variants[selectedVariant]
    if (!workspace || !selectedBusinessId || !variant) return

    setNotice('')
    const result = await saveContentDraft({
      workspaceId: workspace.id,
      body: {
        business_id: selectedBusinessId,
        topic: topic.trim(),
        audience: audience.trim() || undefined,
        tone,
        call_to_action: callToAction.trim() || undefined,
        caption: variant.caption,
        hashtags: variant.hashtags,
      },
    })

    if ('data' in result) {
      setNotice('Draft saved to your content library.')
      setVariants([])
    }
  }

  const handleSaveEdit = async (draft: ContentDraft) => {
    const caption = draftCaptions[draft.id] ?? draft.caption
    const result = await updateContentDraft({
      draftId: draft.id,
      body: { caption },
    })
    if ('data' in result) setNotice('Draft changes saved.')
  }

  const handleArchive = async (draft: ContentDraft) => {
    const result = await updateContentDraft({
      draftId: draft.id,
      body: { status: 'archived' },
    })
    if ('data' in result) setNotice('Draft archived.')
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Caption copied to clipboard.')
    } catch {
      setNotice('Clipboard access is unavailable in this browser.')
    }
  }

  if (!workspace || businessesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (businessesError || !businesses) {
    return <Alert severity="error">Business profiles could not be loaded.</Alert>
  }

  if (businesses.length === 0) {
    return (
      <Alert severity="info">
        Create a business profile before writing content.
      </Alert>
    )
  }

  return (
    <Stack spacing={4}>
      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Content Studio
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Create, refine, and save Instagram caption drafts for your
              business.
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/app/content/video"
            variant="outlined"
            startIcon={<Video size={18} />}
          >
            Open Video Studio
          </Button>
        </Stack>
      </Box>

      {notice && (
        <Alert severity="success" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <Alert severity="info">
        Draft suggestions currently use built-in writing patterns, not an
        external AI model. Review all copy before publishing.
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            Create a caption
          </Typography>
          <Box component="form" onSubmit={handleGenerate}>
            <Stack spacing={2}>
              <TextField
                select
                label="Business"
                value={selectedBusinessId}
                onChange={(event) => {
                  setBusinessId(event.target.value)
                  setVariants([])
                }}
              >
                {businesses.map((business) => (
                  <MenuItem key={business.id} value={business.id}>
                    {business.name} · {business.industry}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="What is this post about?"
                placeholder="A new seasonal menu, product launch, or useful tip"
                required
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                label="Who is it for? (optional)"
                placeholder="For example, busy parents or first-time visitors"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                select
                label="Tone"
                value={tone}
                onChange={(event) =>
                  setTone(event.target.value as ContentTone)
                }
              >
                {toneOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Call to action (optional)"
                placeholder="Visit us this weekend"
                value={callToAction}
                onChange={(event) => setCallToAction(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              {generationState.isError && (
                <Alert severity="error">
                  Could not create caption suggestions. Please try again.
                </Alert>
              )}
              <Button
                type="submit"
                variant="contained"
                startIcon={
                  generationState.isLoading ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <Sparkles size={18} />
                  )
                }
                disabled={generationState.isLoading || !topic.trim()}
              >
                Generate caption ideas
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {variants.length > 0 && (
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Choose a starting point
          </Typography>
          {variants.map((variant, index) => (
            <Card
              key={variant.label}
              variant="outlined"
              sx={{
                borderColor: selectedVariant === index ? 'primary.main' : undefined,
              }}
            >
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {variant.label}
                  </Typography>
                  {selectedVariant === index && (
                    <Chip size="small" color="primary" label="Selected" />
                  )}
                </Stack>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                  {variant.caption}
                </Typography>
                <Typography color="primary.main" sx={{ mt: 2 }}>
                  {variant.hashtags.map((tag) => `#${tag}`).join(' ')}
                </Typography>
                <Button
                  sx={{ mt: 2 }}
                  variant={selectedVariant === index ? 'contained' : 'outlined'}
                  onClick={() => setSelectedVariant(index)}
                >
                  Use this idea
                </Button>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saveState.isLoading}
          >
            {saveState.isLoading ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              'Save selected draft'
            )}
          </Button>
          {saveState.isError && (
            <Alert severity="error">
              Could not save this draft. Please try again.
            </Alert>
          )}
        </Stack>
      )}

      <Stack spacing={2}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Saved drafts
        </Typography>
        {draftsLoading && <CircularProgress size={24} />}
        {draftsError && (
          <Alert severity="error">
            Saved drafts could not be loaded. Try selecting the business again.
          </Alert>
        )}
        {!draftsLoading && !draftsError && drafts?.length === 0 && (
          <Typography color="text.secondary">
            No drafts for this business yet. Generate a caption idea to get started.
          </Typography>
        )}
        {drafts?.map((draft) => (
          <Card key={draft.id} variant="outlined">
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Typography sx={{ fontWeight: 700 }}>{draft.title}</Typography>
                <Chip size="small" label="Instagram · Draft" />
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Edit caption"
                value={draftCaptions[draft.id] ?? draft.caption}
                onChange={(event) =>
                  setDraftCaptions((current) => ({
                    ...current,
                    [draft.id]: event.target.value,
                  }))
                }
              />
              <Typography color="primary.main" sx={{ mt: 1 }}>
                {draft.hashtags.map((tag) => `#${tag}`).join(' ')}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button
                  startIcon={<Copy size={16} />}
                  onClick={() =>
                    void handleCopy(
                      `${draftCaptions[draft.id] ?? draft.caption}\n\n${draft.hashtags.map((tag) => `#${tag}`).join(' ')}`,
                    )
                  }
                >
                  Copy
                </Button>
                <Button
                  onClick={() => void handleSaveEdit(draft)}
                  disabled={updateState.isLoading}
                >
                  Save changes
                </Button>
                <Button
                  color="inherit"
                  startIcon={<Archive size={16} />}
                  onClick={() => void handleArchive(draft)}
                  disabled={updateState.isLoading}
                >
                  Archive
                </Button>
              </Stack>
              {updateState.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Could not update this draft. Please try again.
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
