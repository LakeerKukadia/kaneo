import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { sendInvitationEmail } from "../../utils/mailer";

async function inviteWorkspaceUser(workspaceId: string, userId: string) {
  const [workspace] = await db
    .select()
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId));

  if (!workspace) {
    throw new HTTPException(404, {
      message: "Workspace not found",
    });
  }

  const [existingUser] = await db
    .select()
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    );

  if (existingUser) {
    throw new HTTPException(400, {
      message: "User is already invited to this workspace",
    });
  }

  const [invitedUser] = await db
    .insert(workspaceUserTable)
    .values({
      userId,
      workspaceId,
    })
    .returning();

  // Get user details for email notification
  const [user] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId));

  if (user) {
    try {
      await sendInvitationEmail({
        userEmail: user.email,
        userName: user.name,
        workspaceName: workspace.name,
      });
    } catch (err) {
      console.error("Failed to send invitation email:", err);
    }
  }

  return invitedUser;
}

export default inviteWorkspaceUser;
