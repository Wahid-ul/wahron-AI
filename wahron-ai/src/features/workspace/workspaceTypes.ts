export interface OrganizationSummary {
  id: string
  name: string
}

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface Workspace {
  id: string
  name: string
  role: WorkspaceRole
  organization: OrganizationSummary
}

export interface CreateOrganizationRequest {
  name: string
  workspace_name?: string
}

export interface CreateOrganizationResponse {
  organization: OrganizationSummary
  workspace: Workspace
}
