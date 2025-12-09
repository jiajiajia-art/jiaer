export interface CreateWorldSessionResponse {
    success: true,
    message: string,
    session: {
        sessionId: string,
        fileId: string,
        currentRound: number,
        worldInfo: {
            title: string,
            summary: string,
            themes: string[]
        },
        player: {
            name: string,
            age: number,
            gender: string,
            personality: string,
            appearance: string,
            tone: string,
            imagePath: string
        }
    }
}