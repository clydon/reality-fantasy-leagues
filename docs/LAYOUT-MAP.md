# Global Components

- **AuthGate** wraps every page and decides between the login screen and the full app shell.
- **LoginScreen** replaces the whole app when signed out, with the banner, a Log in card, a Take a Tour button and a Create account link.
- **Inline: Impersonation Banner** is a sticky blue bar across the top while an admin is viewing as another user.
- **Inline: Demo Banner** is a sticky bar across the top while previewing demo data, with an Exit Tour button.
- **MobileNav** is the phone-only top bar (logo, league switcher, chat) and bottom tab bar (Overview, Episodes, Scoreboard, a Draft or Chat or Mid-Season slot, More), plus the More sheet.
- **ReportModal** is the Report an Issue dialog, opened from the sidebar or the More sheet.
- **ConfirmDialog** is the shared confirm/cancel popup used by every destructive action.
- **InstallHint** (banner variant) is a phone-only "add to home screen" strip above the page content.
- **Sidebar** is the desktop left rail with the logo, league switcher, page links, the admin links, Account settings, Report an Issue and the demo toggle.
- **LeagueSwitcher** is the league name dropdown near the top of the Sidebar for moving between leagues.
- **NavLink** is each page link in the Sidebar, with an optional unread or urgent badge.
- **Inline: No-League Notice** is a small strip at the top of the page content for a signed-in user with no league yet, linking to My Leagues.
- **Inline: Flash Message** is a dismissible notice at the top of the page content after actions such as joining a league.

### Overview (`/`)

#### Layout Structure
Single column, then a two-column card grid (one column on phones), then a full-width board.

#### UI Components
- **Inline: Page Title** shows the "Overview" heading.
- **Inline: Catch-Up Notice** says how far a catching-up league has played, shown only in catch-up mode.
- **NotificationsBanner** lists recent notifications for the signed-in player.
- **SideBetsSection** shows the open side bets for the upcoming episode.
- **BetCard** is one side bet inside SideBetsSection, with its predictions and grading.
- **LatestEpisodeCard** summarises the most recent episode's results.
- **SeasonStatusCard** shows where the season stands (draft, episodes played, who is left).
- **StandingsCard** shows the league standings as a wide card.
- **Inline: Board Heading** labels the board once the draft is complete.
- **BoardGrid** shows every cast member grouped by current tribe or team, with photo, owners, elimination medal or number, and a role badge.

### My Leagues (`/dashboard`)

#### Layout Structure
Centered single narrow column. This page also replaces any league page for a signed-in user with no league.

#### UI Components
- **Dashboard** is the whole page, containing everything below.
- **Inline: Banner Image** shows the app banner, only when signed out.
- **Inline: Sign-In Prompt** asks a signed-out visitor to sign in to join or create a league.
- **Inline: Signed-In Line** shows who is signed in and a Back to league link.
- **Inline: Error Message** shows the last join or create error.
- **Inline: Invites Panel** lists pending league invites with Accept and Decline.
- **Inline: Join a League Panel** takes a join code.
- **Inline: Create a League Panel** takes a new league name and makes you commissioner.

### Draft (`/draft`)

#### Layout Structure
Single column of stacked panels. The panels shown depend on ownership mode.

#### UI Components
- **DraftBoard** is the whole page and picks which panels to show.
- **Inline: Page Title** shows the "Draft" heading, or a no-roster message for Pick'em leagues.
- **DraftOrderPanel** sets and reorders the draft order before the draft (exclusive ownership only).
- **DraftStatusPanel** shows whose turn it is, draft progress, and start or force-start controls.
- **BlindDraftPanel** lets each player lock in secret picks before the reveal (shared ownership only).
- **DraftResultsPanel** shows each player's original picks with undraft controls and role badges.
- **FreeAgentsPanel** shows undrafted cast members to click and draft for the current turn (exclusive ownership only).

### Episodes (`/episodes`)

#### Layout Structure
Single column list of expandable episode cards, newest first.

#### UI Components
- **Inline: Page Title** shows the "Episodes" heading.
- **CatchUpPanel** lets the commissioner reveal the next episode in catch-up mode.
- **EpisodeCard** is one collapsible episode, repeated per episode, containing everything below.
- **Inline: Episode Header** shows the number, title, air date, eliminations summary and Post-Merge and Bets tags.
- **Inline: Episode Controls** hold the episode number field, the post-merge checkbox (shows with a merge only) and the edit toggle.
- **EpisodeRecap** shows the episode's Reward and Immunity winners (a tribe chip when a whole tribe won, otherwise player cards), then a player card for each person who left, with how they went.
- **Inline: Roles List** shows who became a Traitor that episode.
- **Inline: Team Moves List** shows who changed tribe or team that episode.
- **Inline: Add Eliminated Player** lets the commissioner log an exit and its method.
- **Inline: Record a Role** lets the commissioner mark someone as a Traitor (Traitors shows only).
- **Inline: Record a Tribe Change** lets the commissioner move someone to a tribe, team or pair, or to no group.
- **EpisodePicksSection** shows each player's weekly pick and pick controls (Pick'em leagues only).
- **EpisodeActiveRosterSection** shows each player's episode like the Scoreboard breakdown: starters and what each scored, then bench players who would have scored, plus the event log (Active Roster leagues only).
- **Inline: Side Bets Heading** labels the episode's side bets.
- **EpisodeBetRow** is one side bet with each guess on one line and how it went; grading and the research suggestion sit behind its edit button.
- **Inline: Add Side Bet** proposes a new side bet with a point value.

### Mid-Season (`/mid-season`)

#### Layout Structure
Single column of stacked panels, each shown only when enabled.

#### UI Components
- **MidSeasonTab** is the whole page and gates each panel.
- **Inline: Page Title** shows the "Mid-Season Tools" heading.
- **Inline: Replenish and Swap Intro** explains when to run Replenish and Swap.
- **ReplenishPanel** runs the replenish round for players who lost cast members.
- **TransactionHistory** lists past replenish and swap moves under each panel.
- **TradePanel** runs the swap (drop and add) round.
- **FinalePanel** collects each player's top-3 and winner predictions and the commissioner's actual result.

### Scoreboard (`/scoreboard`)

#### Layout Structure
Single column of ranked player rows.

#### UI Components
- **ScoreboardTab** is the whole page and picks the row type for the league.
- **Inline: Page Title** shows the "Scoreboard" heading.
- **LeaderboardRow** is one player's rank, total, elimination-order points and roster detail (Classic leagues).
- **PickEmLeaderboardRow** is one player's rank, total and pick history (Pick'em leagues).
- **ActiveRosterLeaderboardRow** is one player's rank, total, scored events and roster detail (Active Roster leagues).
- **Inline: Scoring Note** reminds you to log the winner as the final elimination (Classic leagues only).

### Chat (`/chat`)

#### Layout Structure
Fixed-height column with a scrolling message list and a message box pinned to the bottom.

#### UI Components
- **ChatTab** is the whole page.
- **Inline: Page Title** shows the "Chat" heading.
- **ChatMessageRow** is one message with author, time, reactions and edit or delete.
- **MentionText** highlights cast member names inside a message.
- **Inline: Message Composer** is the text box and Send button.

### League Settings (`/setup`)

#### Layout Structure
Single column of stacked settings sections. During first-time setup, only the basics show.

#### UI Components
- **SetupTab** is the whole page and hides most sections until setup is complete.
- **Inline: Page Title** shows the "League Settings" heading.
- **Inline: Read-Only Note** tells non-commissioners they can only view.
- **LeagueInfoSection** sets the league name, show, season, league type and ownership mode, and guides first-time setup.
- **Inline: Setup Locked Note** says the rest unlocks once the basics are set, shown during setup only.
- **PlayersSection** adds, edits, disables and removes players.
- **InvitesSection** sends and manages league invites.
- **TribesSection** adds, renames, recolours and removes tribes or teams.
- **CastawaysSection** adds and edits cast members, their tribe and photo.
- **GeneralSettingsSection** sets roster size, replenish and swap toggles, and replenish order.
- **SideBetSettingsSection** turns side bets on or off and sets default points.
- **FinaleSettingsSection** turns finale predictions on or off and sets their points.
- **PickEmSettingsSection** sets points for a correct weekly pick (Pick'em leagues only).
- **ActiveRosterSettingsSection** sets active and bench slots and points per scoring event (Active Roster leagues only).
- **WikiConnectorSection** shows the wiki connector status and any pending cast proposals for the league.
- **BackupSection** exports and imports the league as a backup file.
- **LeaveLeagueSection** lets a player leave the league.

### Account (`/account`)

#### Layout Structure
Centered single narrow column.

#### UI Components
- **AccountPanel** is the whole page, showing settings when signed in or sign-up when signed out.
- **Inline: Page Title** shows the "Account settings" heading when signed in.
- **ProfileSection** edits name, username and email.
- **PasswordSection** changes the password.
- **NotificationsSection** manages push notification permissions and preferences.
- **InstallHint** (section variant) explains how to install the app on a phone.
- **LogOutButton** signs out.
- **Inline: Banner Image** shows the app banner when signed out.
- **Inline: Create Your Account Form** takes name, username, email and password when signed out.
- **Inline: Sign-In Link** points existing users back to log in.

### Forgot Password (`/forgot-password`)

#### Layout Structure
Centered single narrow column.

#### UI Components
- **Inline: Page Title** shows the "Reset password" heading.
- **Inline: Reset Request Card** takes an email and then confirms a reset link was sent.
- **Inline: Back to Sign In Link** returns to the account page.

### Reset Password (`/reset-password`)

#### Layout Structure
Centered single narrow column.

#### UI Components
- **Inline: Page Title** shows the "Set a new password" heading.
- **ResetPasswordForm** takes the new password from an emailed link and confirms it was updated.
- **Inline: Back to Sign In Link** returns to the account page.

### Admin (`/admin`)

#### Layout Structure
Single column of full-width admin sections (super-admins only).

#### UI Components
- **AdminTab** is the whole page.
- **Inline: Page Title** shows the "Admin" heading.
- **ShowsSection** manages the show and season catalog, with the AI model pickers and Add a show.
- **ShowRow** is one show with its season count, league count and settings toggle.
- **ShowSettings** edits a show's terms, rules format, wiki API, cast heading and research sites, with archive and delete.
- **SeasonCard** is one season's pipeline: pull and approve the cast, then pull and review episodes.
- **SeasonCastReview** reviews, edits and approves the staged cast, and holds tribes back until an episode.
- **SeasonEpisodes** lists aired and upcoming episodes with Review and Research buttons and the auto-research schedule.
- **EpisodeDecisions** reviews one episode's staged results, with Accept all and a collapsible Team Changes block.
- **PullResult** reports what a wiki pull found and what it cost.
- **ResearchResult** reports what an episode's research found, per person, with sources and cost.
- **Inline: Temp Password Notice** shows a newly generated temporary password once.
- **Inline: Users Table** lists every account with role, created and last login dates, and edit, reset, impersonate and delete actions.
- **Pager** pages through the users list.
- **Inline: Leagues List** lists every league, expandable to its players and linked accounts.
- **LinkMembershipForm** links a league player to a user account.
- **Pager** pages through the leagues list.
- **UserEditModal** is the popup for editing a user's details and role.

### Reports (`/reports`)

#### Layout Structure
Single column with a full-width, horizontally scrolling table (super-admins only).

#### UI Components
- **ReportsTab** is the whole page.
- **Inline: Page Title** shows the "Bug & Feature Reports" heading.
- **Inline: Reports Table** lists each report's sender, type, page, message and time, with a delete button.
