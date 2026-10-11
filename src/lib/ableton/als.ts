/**
 * Writes an Ableton Live Set (.als XML) from a Session, using a set saved from the user's own
 * Ableton as the template. Working from a real set keeps the file in the exact format of their
 * Live version, and keeps whatever they set up in it:
 *
 * - An audio track named after a stem group ("Click", "Guide", "Drums"…) is filled with that
 *   group's clips and keeps its routing, devices and colour (e.g. click and guide to in-ear outputs).
 * - Other tracks (MIDI, groups, effects) are left as they are.
 * - A plain audio track ("1-Audio") is the pattern for every other stem track; its first audio
 *   clip, if it has one, is the pattern for clips, and its first locator the pattern for locators.
 *
 * Pure string work so it runs in the browser and in tests. The .als file is this XML, gzipped.
 */
import { classifyStem, GROUPS, type StemGroup } from "../tracks/stems.ts";
import type { Clip, Session, SessionTrack } from "./session.ts";

export interface TemplateInfo {
  ok: boolean;
  /** e.g. "Ableton Live 12.0.5" */
  creator: string;
  major: number;
  problems: string[];
  audioTracks: string[];
  otherTracks: number;
  hasClip: boolean;
  hasLocator: boolean;
}

const TRACK_RE = /<(AudioTrack|MidiTrack|GroupTrack)\s+Id="(\d+)"[^>]*>[\s\S]*?<\/\1>/g;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const num = (x: number) => String(Math.round(x * 1e6) / 1e6);

/** The name shown on a track: its own name if given, else Live's automatic one. */
export function trackName(xml: string): string {
  const user = /<UserName Value="([^"]*)"/.exec(xml)?.[1] ?? "";
  const eff = /<EffectiveName Value="([^"]*)"/.exec(xml)?.[1] ?? "";
  return unesc(user || eff);
}

/** The group a template track stands for, or null for a plain track like "1-Audio". */
export function templateGroup(xml: string): StemGroup | null {
  const user = unesc(/<UserName Value="([^"]*)"/.exec(xml)?.[1] ?? "");
  if (!user) return null;
  const g = classifyStem(user);
  return g === "other" || g === "mix" ? (/^(full )?mix$/i.test(user.trim()) ? "mix" : null) : g;
}

export function inspectTemplate(xml: string): TemplateInfo {
  const creator = /Creator="([^"]*)"/.exec(xml)?.[1] ?? "";
  const major = Number(/Creator="Ableton Live (\d+)/.exec(xml)?.[1] ?? 0);
  const tracks = [...xml.matchAll(TRACK_RE)];
  const audio = tracks.filter((t) => t[1] === "AudioTrack");
  const problems: string[] = [];
  if (!/<Ableton[\s>]/.test(xml) || !/<LiveSet>/.test(xml)) problems.push("This isn't an Ableton Live Set. Save a set in Ableton and choose its .als file.");
  else {
    if (!audio.length) problems.push("The set needs at least one audio track.");
    if (!/<(MasterTrack|MainTrack)>/.test(xml)) problems.push("The set has no master track.");
    if (major && major < 10) problems.push(`This set was saved by Live ${major}. Use Live 10, 11 or 12.`);
  }
  return {
    ok: problems.length === 0, creator, major, problems,
    audioTracks: audio.map((t) => trackName(t[0])), otherTracks: tracks.length - audio.length,
    hasClip: /<AudioClip\s/.test(xml), hasLocator: /<Locator\s+Id=/.test(xml),
  };
}

/** Live's 70-colour palette indices that suit each group. */
const COLOR: Record<StemGroup, number> = { click: 13, guide: 12, drums: 14, perc: 56, bass: 1, ag: 9, eg: 15, keys: 20, synth: 22, pad: 24, strings: 18, vox: 2, bgv: 3, mix: 69, other: 69 };

/**
 * Ableton's encoding of a time signature in automation: numerator - 1 + 99 × log2(denominator).
 * 4/4 → 201, 3/4 → 200, 6/8 → 302.
 */
export const sigValue = (num: number, den: number) => num - 1 + 99 * Math.round(Math.log2(den));

export function renderAls(template: string, session: Session): string {
  const info = inspectTemplate(template);
  if (!info.ok) throw new Error(info.problems.join(" "));
  let xml = template;
  let nextId = Number(/<NextPointeeId Value="(\d+)"/.exec(xml)?.[1] ?? 0);
  // ids that must be unique across the whole set
  const maxSeen = Math.max(0, ...[...xml.matchAll(/<(?:\w*Target|Pointee|\w*ModulationTarget)\s+Id="(\d+)"/g)].map((m) => +m[1]!));
  nextId = Math.max(nextId, maxSeen + 1);
  const freshIds = (s: string) => s.replace(/<((?:\w*Target|Pointee))\s+Id="\d+"/g, (_m, tag: string) => `<${tag} Id="${nextId++}"`);

  /* ---- tracks ---- */
  const tracksBlock = /<Tracks>([\s\S]*?)<\/Tracks>/.exec(xml);
  if (!tracksBlock) throw new Error("The set has no tracks section.");
  const existing = [...tracksBlock[1]!.matchAll(TRACK_RE)].map((m) => ({ xml: m[0], kind: m[1]!, id: +m[2]! }));
  let trackId = Math.max(0, ...existing.map((t) => t.id)) + 1;
  const plain = existing.find((t) => t.kind === "AudioTrack" && !templateGroup(t.xml)) ?? existing.find((t) => t.kind === "AudioTrack")!;
  const clipProto = /<AudioClip\s[\s\S]*?<\/AudioClip>/.exec(xml)?.[0] ?? null;

  // match session tracks to named template tracks, first come first served
  const used = new Set<number>();
  const filled = new Map<number, SessionTrack>();
  const extra: SessionTrack[] = [];
  for (const st of session.tracks) {
    const i = existing.findIndex((t, k) => !used.has(k) && t.kind === "AudioTrack" && templateGroup(t.xml) === st.group && trackName(t.xml).toLowerCase() === st.name.toLowerCase());
    const j = i >= 0 ? i : existing.findIndex((t, k) => !used.has(k) && t.kind === "AudioTrack" && templateGroup(t.xml) === st.group);
    if (j >= 0) { used.add(j); filled.set(j, st); } else extra.push(st);
  }

  const pieces: string[] = [];
  let insertedExtra = false;
  const makeExtra = () => extra.map((st) => withClips(renameTrack(freshIds(clearClips(plain.xml)).replace(/^<AudioTrack\s+Id="\d+"/, `<AudioTrack Id="${trackId++}"`), st.name, COLOR[st.group]), st.clips, clipProto));
  existing.forEach((t, k) => {
    const st = filled.get(k);
    if (st) { pieces.push(withClips(clearClips(t.xml), st.clips, clipProto)); return; }
    if (t === plain && !templateGroup(t.xml)) {
      // the plain pattern track is replaced by the generated stem tracks
      if (!insertedExtra) { pieces.push(...makeExtra()); insertedExtra = true; }
      return;
    }
    pieces.push(t.xml);
  });
  if (!insertedExtra) {
    // the pattern was a named track that is in use; generated tracks go first
    pieces.unshift(...makeExtra());
  }
  xml = xml.replace(/<Tracks>[\s\S]*?<\/Tracks>/, () => `<Tracks>\n${pieces.join("\n")}\n</Tracks>`);

  /* ---- tempo and time signature on the master track ---- */
  const master = /<(MasterTrack|MainTrack)>[\s\S]*?<\/\1>/.exec(xml);
  if (master) {
    let m = master[0];
    const tempoTarget = /<Tempo>[\s\S]*?<AutomationTarget Id="(\d+)"/.exec(m)?.[1];
    const sigTarget = /<TimeSignature>[\s\S]*?<AutomationTarget Id="(\d+)"/.exec(m)?.[1];
    const first = session.tempo[0];
    if (first) m = m.replace(/(<Tempo>[\s\S]*?<Manual Value=")[^"]*(")/, `$1${num(first.bpm)}$2`);
    const firstSig = session.sig[0];
    if (firstSig) m = m.replace(/(<TimeSignature>[\s\S]*?<Manual Value=")[^"]*(")/, `$1${sigValue(firstSig.num, firstSig.den)}$2`);
    const envs: string[] = [];
    let envId = 0;
    const envelope = (target: string, events: string) => `<AutomationEnvelope Id="${envId++}"><EnvelopeTarget><PointeeId Value="${target}" /></EnvelopeTarget><Automation><Events>${events}</Events><AutomationTransformViewState><IsTransformPending Value="false" /><TimeAndValueTransforms /></AutomationTransformViewState></Automation></AutomationEnvelope>`;
    if (tempoTarget && session.tempo.length) {
      let ev = 0, prev = session.tempo[0]!.bpm;
      const events = [`<FloatEvent Id="${ev++}" Time="-63072000" Value="${num(prev)}" />`];
      for (const t of session.tempo.slice(1)) {
        // a step: hold the old tempo up to the change, then jump
        if (t.bpm === prev) continue;
        events.push(`<FloatEvent Id="${ev++}" Time="${num(t.beat)}" Value="${num(prev)}" />`, `<FloatEvent Id="${ev++}" Time="${num(t.beat)}" Value="${num(t.bpm)}" />`);
        prev = t.bpm;
      }
      if (events.length > 1) envs.push(envelope(tempoTarget, events.join("")));
    }
    if (sigTarget && session.sig.length > 1) {
      let ev = 0, prev = sigValue(session.sig[0]!.num, session.sig[0]!.den);
      const events = [`<EnumEvent Id="${ev++}" Time="-63072000" Value="${prev}" />`];
      for (const s of session.sig.slice(1)) {
        const v = sigValue(s.num, s.den);
        if (v === prev) continue;
        events.push(`<EnumEvent Id="${ev++}" Time="${num(s.beat)}" Value="${v}" />`);
        prev = v;
      }
      if (events.length > 1) envs.push(envelope(sigTarget, events.join("")));
    }
    if (envs.length) {
      // replace the master's own envelopes (the first AutomationEnvelopes block in the track)
      m = m.replace(/<AutomationEnvelopes>\s*(?:<Envelopes\s*\/>|<Envelopes>[\s\S]*?<\/Envelopes>)\s*<\/AutomationEnvelopes>/, `<AutomationEnvelopes><Envelopes>${envs.join("")}</Envelopes></AutomationEnvelopes>`);
    }
    xml = xml.replace(master[0], () => m);
  }

  /* ---- locators ---- */
  const protoLoc = /<Locator\s+Id="\d+">[\s\S]*?<\/Locator>/.exec(xml)?.[0] ?? `<Locator Id="0"><LomId Value="0" /><Time Value="0" /><Name Value="" /><Annotation Value="" /><IsSongStart Value="false" /></Locator>`;
  const locs = session.locators.map((l, i) => protoLoc
    .replace(/^<Locator\s+Id="\d+">/, `<Locator Id="${i}">`)
    .replace(/<Time Value="[^"]*"/, `<Time Value="${num(l.beat)}"`)
    .replace(/<Name Value="[^"]*"/, `<Name Value="${esc(l.name)}"`)
    .replace(/<IsSongStart Value="[^"]*"/, '<IsSongStart Value="false"'));
  const locBlock = `<Locators><Locators>${locs.join("")}</Locators></Locators>`;
  xml = /<Locators>\s*<Locators\s*\/>\s*<\/Locators>|<Locators>\s*<Locators>[\s\S]*?<\/Locators>\s*<\/Locators>/.test(xml)
    ? xml.replace(/<Locators>\s*<Locators\s*\/>\s*<\/Locators>|<Locators>\s*<Locators>[\s\S]*?<\/Locators>\s*<\/Locators>/, () => locBlock)
    : xml.replace(/<\/LiveSet>/, () => `${locBlock}</LiveSet>`);

  /* ---- start at the top, loop off ---- */
  xml = xml.replace(/(<Transport>[\s\S]*?<CurrentTime Value=")[^"]*(")/, "$10$2").replace(/(<Transport>[\s\S]*?<LoopOn Value=")[^"]*(")/, "$1false$2");
  xml = xml.replace(/<NextPointeeId Value="\d+"/, `<NextPointeeId Value="${nextId + 1}"`);
  return xml;
}

function clearClips(track: string): string {
  // arrangement clips live in ArrangerAutomation > Events of the track's sequencer
  return track.replace(/(<ArrangerAutomation>\s*<Events)(?:\s*\/>|>[\s\S]*?<\/Events>)/, "$1 />");
}

function renameTrack(track: string, name: string, color: number): string {
  return track
    .replace(/<EffectiveName Value="[^"]*"/, `<EffectiveName Value="${esc(name)}"`)
    .replace(/<UserName Value="[^"]*"/, `<UserName Value="${esc(name)}"`)
    .replace(/<Color Value="\d+"/, `<Color Value="${color}"`);
}

function withClips(track: string, clips: Clip[], proto: string | null): string {
  if (!clips.length) return track;
  const body = clips.map((c, i) => clipXml(c, i, proto)).join("");
  return track.replace(/<ArrangerAutomation>\s*<Events\s*\/>/, `<ArrangerAutomation><Events>${body}</Events>`);
}

/** An arrangement audio clip that plays its file at the song's own tempo (two warp markers). */
export function clipXml(c: Clip, id: number, proto: string | null): string {
  const end = c.start + c.length, rel = `Samples/Imported/${c.file}`;
  const sr = c.sampleRate ?? 44100;
  const warp = `<WarpMarkers><WarpMarker Id="0" SecTime="0" BeatTime="0" /><WarpMarker Id="1" SecTime="${num(60 / c.bpm)}" BeatTime="1" /></WarpMarkers>`;
  if (proto) {
    let x = proto
      .replace(/^<AudioClip\s+Id="\d+"\s+Time="[^"]*"/, `<AudioClip Id="${id}" Time="${num(c.start)}"`)
      .replace(/<CurrentStart Value="[^"]*"/, `<CurrentStart Value="${num(c.start)}"`)
      .replace(/<CurrentEnd Value="[^"]*"/, `<CurrentEnd Value="${num(end)}"`)
      .replace(/<LoopStart Value="[^"]*"/, '<LoopStart Value="0"')
      .replace(/<LoopEnd Value="[^"]*"/, `<LoopEnd Value="${num(c.length)}"`)
      .replace(/<StartRelative Value="[^"]*"/, '<StartRelative Value="0"')
      .replace(/<LoopOn Value="[^"]*"/, '<LoopOn Value="false"')
      .replace(/<OutMarker Value="[^"]*"/, `<OutMarker Value="${num(c.length)}"`)
      .replace(/<HiddenLoopStart Value="[^"]*"/, '<HiddenLoopStart Value="0"')
      .replace(/<HiddenLoopEnd Value="[^"]*"/, `<HiddenLoopEnd Value="${num(c.length)}"`)
      .replace(/(<AudioClip[^>]*>[\s\S]*?)<Name Value="[^"]*"/, `$1<Name Value="${esc(c.name)}"`)
      .replace(/<IsWarped Value="[^"]*"/, '<IsWarped Value="true"')
      .replace(/<WarpMarkers\s*\/>|<WarpMarkers>[\s\S]*?<\/WarpMarkers>/, warp)
      .replace(/<RelativePathType Value="[^"]*"/, '<RelativePathType Value="3"')
      .replace(/<RelativePath Value="[^"]*"/, `<RelativePath Value="${esc(rel)}"`)
      .replace(/<Path Value="[^"]*"/, `<Path Value="${esc(rel)}"`)
      .replace(/<OriginalFileSize Value="[^"]*"/, '<OriginalFileSize Value="0"')
      .replace(/<OriginalCrc Value="[^"]*"/, '<OriginalCrc Value="0"')
      .replace(/<DefaultDuration Value="[^"]*"/, `<DefaultDuration Value="${Math.round(c.seconds * sr)}"`)
      .replace(/<DefaultSampleRate Value="[^"]*"/, `<DefaultSampleRate Value="${sr}"`);
    // Live 10 stores the path as RelativePathElement list + Name
    x = x.replace(/<FileRef>[\s\S]*?<\/FileRef>/, (ref) => ref
      .replace(/<RelativePath>[\s\S]*?<\/RelativePath>/, `<RelativePath><RelativePathElement Id="0" Dir="Samples" /><RelativePathElement Id="1" Dir="Imported" /></RelativePath>`)
      .replace(/<Name Value="[^"]*"/, `<Name Value="${esc(c.file)}"`));
    return x;
  }
  return `<AudioClip Id="${id}" Time="${num(c.start)}"><LomId Value="0" /><LomIdView Value="0" /><CurrentStart Value="${num(c.start)}" /><CurrentEnd Value="${num(end)}" /><Loop><LoopStart Value="0" /><LoopEnd Value="${num(c.length)}" /><StartRelative Value="0" /><LoopOn Value="false" /><OutMarker Value="${num(c.length)}" /><HiddenLoopStart Value="0" /><HiddenLoopEnd Value="${num(c.length)}" /></Loop><Name Value="${esc(c.name)}" /><Annotation Value="" /><Color Value="${COLOR.other}" /><LaunchMode Value="0" /><LaunchQuantisation Value="0" /><TimeSignature><TimeSignatures><RemoteableTimeSignature Id="0"><Numerator Value="4" /><Denominator Value="4" /><Time Value="0" /></RemoteableTimeSignature></TimeSignatures></TimeSignature><Envelopes><Envelopes /></Envelopes><ScrollerTimePreserver><LeftTime Value="0" /><RightTime Value="0" /></ScrollerTimePreserver><TimeSelection><AnchorTime Value="0" /><OtherTime Value="0" /></TimeSelection><Legato Value="false" /><Ram Value="false" /><GrooveSettings><GrooveId Value="-1" /></GrooveSettings><Disabled Value="false" /><VelocityAmount Value="0" /><FollowAction><FollowTime Value="4" /><IsLinked Value="true" /><LoopIterations Value="1" /><FollowActionA Value="4" /><FollowActionB Value="0" /><FollowChanceA Value="100" /><FollowChanceB Value="0" /><JumpIndexA Value="1" /><JumpIndexB Value="1" /><FollowActionEnabled Value="false" /></FollowAction><Grid><FixedNumerator Value="1" /><FixedDenominator Value="16" /><GridIntervalPixel Value="20" /><Ntoles Value="2" /><SnapToGrid Value="true" /><Fixed Value="false" /></Grid><FreezeStart Value="0" /><FreezeEnd Value="0" /><IsWarped Value="true" /><TakeId Value="1" /><SampleRef><FileRef><RelativePathType Value="3" /><RelativePath Value="${esc(rel)}" /><Path Value="${esc(rel)}" /><Type Value="1" /><LivePackName Value="" /><LivePackId Value="" /><OriginalFileSize Value="0" /><OriginalCrc Value="0" /></FileRef><LastModDate Value="0" /><SourceContext /><SampleUsageHint Value="0" /><DefaultDuration Value="${Math.round(c.seconds * sr)}" /><DefaultSampleRate Value="${sr}" /></SampleRef><Onsets><UserOnsets /><HasUserOnsets Value="false" /></Onsets><WarpMode Value="4" /><GranularityTones Value="30" /><GranularityTexture Value="65" /><FluctuationTexture Value="25" /><TransientResolution Value="6" /><TransientLoopMode Value="2" /><TransientEnvelope Value="100" /><ComplexProFormants Value="100" /><ComplexProEnvelope Value="128" /><Sync Value="true" /><HiQ Value="true" /><Fade Value="true" /><Fades><FadeInLength Value="0" /><FadeOutLength Value="0" /><ClipFadesAreInitialized Value="true" /><CrossfadeInState Value="0" /><FadeInCurveSkew Value="0" /><FadeInCurveSlope Value="0" /><FadeOutCurveSkew Value="0" /><FadeOutCurveSlope Value="0" /><IsDefaultFadeIn Value="true" /><IsDefaultFadeOut Value="true" /></Fades><PitchCoarse Value="0" /><PitchFine Value="0" /><SampleVolume Value="1" />${warp}<SavedWarpMarkersForStretched /><MarkersGenerated Value="false" /><IsSongTempoLeader Value="false" /></AudioClip>`;
}

export { GROUPS };
