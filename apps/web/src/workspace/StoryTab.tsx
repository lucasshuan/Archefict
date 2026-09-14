import type { CampaignHandles, ConversationHandles } from "@archefict/crdt";
import type { AiSettings } from "@archefict/schema";
import MessageSquarePlus from "lucide-solid/icons/message-square-plus";
import MessageSquareText from "lucide-solid/icons/message-square-text";
import PanelRightClose from "lucide-solid/icons/panel-right-close";
import PanelRightOpen from "lucide-solid/icons/panel-right-open";
import { type Accessor, createResource, onCleanup, onMount, Show } from "solid-js";
import { createTurnRunner } from "../ai/turn.ts";
import type { ConversationStore } from "../campaign/conversations.ts";
import { createDocSignal } from "../campaign/doc-signal.ts";
import { createTimelineController } from "../campaign/timeline.ts";
import { ArchiveShelf } from "../components/ArchiveShelf.tsx";
import { Composer } from "../components/Composer.tsx";
import { ConversationList } from "../components/ConversationList.tsx";
import { NarrativeFeed } from "../components/NarrativeFeed.tsx";
import { Panel } from "../components/Panel.tsx";
import { PanelGroup } from "../components/panel-group.tsx";
import { PanelSection, SectionAction } from "../components/panel-section.tsx";
import { SaveIndicator } from "../components/SaveIndicator.tsx";

type StoryProps = {
  handles: CampaignHandles;
  conversations: ConversationStore;
  settings: Accessor<AiSettings>;
  /** The narrator's instructions for this campaign, the default already applied. */
  instructions: Accessor<string>;
  /** Another page has the session: no shortcuts. */
  blocked: boolean;
};

/**
 * The Story tab: a campaign's conversations beside the one being played. Two panels, peers.
 * The list writes the active id into the store and the narrative follows it, so either could
 * move without the other knowing (docs/workspace.md). The list starts on the right, so hiding
 * it leaves the reading column's left edge where it was; from there the panel group is what
 * moves and resizes the two.
 */
export function StoryTab(props: StoryProps) {
  return (
    <PanelGroup id="story" defaultOrder={["narrative", "conversations"]}>
      <ConversationPane {...props} />
      <Show when={!props.conversations.listHidden()}>
        <Panel
          id="conversations"
          title="Conversations"
          menu={[
            {
              label: "New conversation",
              icon: MessageSquarePlus,
              onSelect: () => void props.conversations.create(),
            },
            {
              label: "Hide panel",
              icon: PanelRightClose,
              onSelect: () => props.conversations.toggleList(),
            },
          ]}
        >
          <PanelSection
            label="Conversations"
            actions={
              <SectionAction
                label="New conversation"
                onClick={() => void props.conversations.create()}
              >
                <MessageSquarePlus size={16} aria-hidden="true" />
              </SectionAction>
            }
          >
            <ConversationList
              open={props.conversations.open()}
              activeId={props.conversations.active()?.id ?? null}
              onSelect={(id) => props.conversations.select(id)}
              onRename={(id, title) => void props.conversations.rename(id, title)}
              onDuplicate={(id) => void props.conversations.duplicate(id)}
              onArchive={(id) => void props.conversations.archive(id)}
            />
          </PanelSection>
          <ArchiveShelf
            items={props.conversations.archived()}
            noun="conversation"
            icon={MessageSquareText}
            onRestore={(id) => void props.conversations.restore(id)}
            onDelete={(ids) => void props.conversations.deleteConversations(ids)}
          />
        </Panel>
      </Show>
    </PanelGroup>
  );
}

/**
 * Opens the active conversation's document and mounts a view on it. Keyed on the handles,
 * so switching conversations gives the view a fresh controller, undo stack and draft. The
 * id check keeps a stale document from showing for the instant the next one takes to load.
 */
function ConversationPane(props: StoryProps) {
  const [opened] = createResource(
    () => props.conversations.active()?.id ?? null,
    (id) => props.handles.openConversation(id),
  );
  const current = () => {
    const handles = opened();
    return handles && handles.id === props.conversations.active()?.id ? handles : null;
  };

  return (
    <Show
      when={props.conversations.active()}
      fallback={<EmptyStory onCreate={() => void props.conversations.create()} />}
    >
      <Show when={current()} keyed>
        {(conversation) => <ConversationView {...props} conversation={conversation} />}
      </Show>
    </Show>
  );
}

/** One conversation: its feed, its composer, its undo. What Slice 0's session column was. */
function ConversationView(props: StoryProps & { conversation: ConversationHandles }) {
  const doc = createDocSignal(props.conversation.timeline);
  const timeline = createTimelineController(props.conversation);
  const turn = createTurnRunner({
    timeline,
    entries: () => doc().entries,
    settings: props.settings,
    instructions: props.instructions,
  });
  const title = () => props.conversations.active()?.title ?? "Narrative";

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (props.blocked || !(event.ctrlKey || event.metaKey) || event.altKey || turn.busy()) {
        return;
      }
      // Inputs keep their own native undo; only the timeline responds outside them.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        void timeline.undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        void timeline.redo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  return (
    <Panel
      id="narrative"
      title={title()}
      width={null}
      status={<SaveIndicator state={timeline.saveState()} />}
      menu={[
        {
          label: props.conversations.listHidden() ? "Show conversations" : "Hide conversations",
          icon: props.conversations.listHidden() ? PanelRightOpen : PanelRightClose,
          onSelect: () => props.conversations.toggleList(),
        },
      ]}
    >
      <NarrativeFeed
        entries={doc().entries}
        streamingText={turn.streamingText()}
        onEdit={(id, text) => void timeline.update(id, text)}
        onDelete={(id) => void timeline.remove(id)}
      />
      <Composer
        draftKey={props.conversation.timeline.url}
        busy={turn.busy()}
        canContinue={props.settings().apiKey !== "" && doc().entries.length > 0}
        error={turn.error() ?? timeline.error()}
        canUndo={timeline.canUndo()}
        canRedo={timeline.canRedo()}
        onSubmit={(text) => void turn.submit(text)}
        onStop={turn.stop}
        onUndo={() => void timeline.undo()}
        onRedo={() => void timeline.redo()}
      />
    </Panel>
  );
}

function EmptyStory(props: { onCreate: () => void }) {
  return (
    <Panel id="narrative" title="Narrative" width={null}>
      <div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p class="font-narrative text-fg-muted">Every conversation is archived.</p>
        <button
          type="button"
          class="rounded-app bg-accent-muted px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 motion-reduce:transition-none"
          onClick={props.onCreate}
        >
          New conversation
        </button>
      </div>
    </Panel>
  );
}
