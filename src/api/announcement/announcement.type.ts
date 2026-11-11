export type AnnouncementStatus = 'draft' | 'published';

export interface AnnouncementSection {
    subtitle: string;
    body: string;
}

export interface AnnouncementSummary {
    id: number;
    title: string;
    status: AnnouncementStatus;
    createdAt: string | null;
    updatedAt: string | null;
    publishedAt: string | null;
}

export interface AnnouncementRecord extends AnnouncementSummary {
    sections: AnnouncementSection[];
}

export interface AnnouncementPayload {
    title: string;
    sections: AnnouncementSection[];
    status: AnnouncementStatus;
}
