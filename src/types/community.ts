export type VoteValue = 1 | -1;

export type CommunityPostImage = Readonly<{
  id?: string;
  uri?: string;
  imageId: string;
  mimeType: string;
  fileName: string;
  sortOrder: number;
}>;

export type CommunityPostImageDraft = Readonly<{
  id?: string;
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
}>;

export type CommunityPost = Readonly<{
  postId: string;
  title: string;
  body: string;
  subjectTag: string;
  linkUrl: string | null;
  images: readonly CommunityPostImage[];
  demoSeed: boolean;
  demoWelcome: boolean;
  score: number;
  commentCount: number;
  createdAt: string;
  authorClerkId: string;
  authorDisplayName: string;
  authorAvatarLetter: string;
  authorImageUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  viewerVote: VoteValue | null;
  viewerSaved: boolean;
}>;

export type CommunityComment = Readonly<{
  commentId: string;
  body: string;
  createdAt: string;
  authorClerkId: string;
  authorDisplayName: string;
  authorAvatarLetter: string;
}>;

export type CommunityGroup = Readonly<{
  groupId: string;
  name: string;
  joinCode: string;
  description: string;
  subjectTag: string | null;
  createdAt: string;
  memberCount: number;
  isMember: boolean;
}>;

export type CommunityGroupDetail = CommunityGroup &
  Readonly<{
    members: readonly CommunityGroupMember[];
  }>;

export type CommunityGroupMember = Readonly<{
  clerkId: string;
  displayName: string;
  avatarLetter: string;
  role: string;
  joinedAt: string;
}>;

export type GroupMessage = Readonly<{
  messageId: string;
  body: string;
  linkUrl: string | null;
  createdAt: string;
  authorClerkId: string;
  authorDisplayName: string;
  authorAvatarLetter: string;
}>;

export type CreatePostInput = Readonly<{
  title: string;
  body: string;
  subjectTag: string;
  linkUrl?: string | null;
  groupId?: string | null;
  displayName: string;
  imageUrl?: string | null;
  images?: readonly Readonly<{
    imageId: string;
    mimeType: string;
    fileName: string;
    sortOrder: number;
  }>[];
}>;

export type CreateGroupInput = Readonly<{
  name: string;
  description: string;
  subjectTag?: string | null;
  displayName: string;
}>;

export type CreateCommentInput = Readonly<{
  body: string;
  displayName: string;
}>;

export type CreateGroupMessageInput = Readonly<{
  body: string;
  linkUrl?: string | null;
  displayName: string;
}>;

export type DashboardStats = Readonly<{
  classesThisWeek: number;
  classesThisMonth: number;
  notesVerifiedCount: number;
  averageScore: number | null;
  streakDays: number;
}>;

export type DashboardActivityKind = "session" | "verification";

export type DashboardActivityItem = Readonly<{
  id: string;
  kind: DashboardActivityKind;
  title: string;
  subtitle: string;
  occurredAt: string;
  deepLink: string | null;
}>;

export type DashboardResponse = Readonly<{
  stats: DashboardStats;
  recentActivity: readonly DashboardActivityItem[];
}>;

export type PostsFeedResponse = Readonly<{
  posts: readonly CommunityPost[];
  count: number;
}>;

export type PostDetailResponse = Readonly<{
  post: CommunityPost;
  comments: readonly CommunityComment[];
}>;

export type VoteResponse = Readonly<{
  score: number;
  viewerVote: VoteValue | null;
}>;

export type SaveResponse = Readonly<{
  viewerSaved: boolean;
}>;
