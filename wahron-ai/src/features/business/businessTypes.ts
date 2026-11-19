export interface Business {
  id: string
  workspace_id: string
  name: string
  industry: string
  description: string | null
  website: string | null
}

export interface CreateBusinessRequest {
  name: string
  industry: string
  description?: string
  website?: string
}

export interface UpdateBusinessRequest {
  name?: string
  industry?: string
  description?: string | null
  website?: string | null
}
