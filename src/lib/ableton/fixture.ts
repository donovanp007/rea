/**
 * A cut-down Live Set in the shape Ableton Live 11/12 saves, for tests: a plain audio track with
 * one clip, an audio track named "Click" routed to outputs 3/4, a MIDI track, one locator.
 * The real check is opening a generated set in Ableton.
 */
export const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="11.0_11300" SchemaChangeCount="3" Creator="Ableton Live 11.3.4" Revision="">
	<LiveSet>
		<NextPointeeId Value="22000" />
		<OverwriteProtectionNumber Value="2816" />
		<LomId Value="0" />
		<LomIdView Value="0" />
		<Tracks>
			<AudioTrack Id="8">
				<LomId Value="0" />
				<Name><EffectiveName Value="1-Audio" /><UserName Value="" /><Annotation Value="" /></Name>
				<Color Value="2" />
				<AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
				<TrackGroupId Value="-1" />
				<DeviceChain>
					<AudioOutputRouting><Target Value="AudioOut/Master" /></AudioOutputRouting>
					<Mixer><Volume><Manual Value="1" /><AutomationTarget Id="100"><LockEnvelope Value="0" /></AutomationTarget></Volume></Mixer>
					<MainSequencer>
						<ClipSlotList />
						<Sample><ArrangerAutomation><Events>
							<AudioClip Id="0" Time="0"><LomId Value="0" /><CurrentStart Value="0" /><CurrentEnd Value="8" /><Loop><LoopStart Value="0" /><LoopEnd Value="8" /><StartRelative Value="0" /><LoopOn Value="false" /><OutMarker Value="8" /><HiddenLoopStart Value="0" /><HiddenLoopEnd Value="8" /></Loop><Name Value="Sample" /><Color Value="2" /><IsWarped Value="true" /><SampleRef><FileRef><RelativePathType Value="1" /><RelativePath Value="../Sample.wav" /><Path Value="/Users/me/Sample.wav" /><Type Value="1" /><LivePackName Value="" /><LivePackId Value="" /><OriginalFileSize Value="1234" /><OriginalCrc Value="999" /></FileRef><LastModDate Value="0" /><SourceContext /><SampleUsageHint Value="0" /><DefaultDuration Value="176400" /><DefaultSampleRate Value="44100" /></SampleRef><WarpMode Value="4" /><WarpMarkers><WarpMarker Id="0" SecTime="0" BeatTime="0" /><WarpMarker Id="1" SecTime="0.5" BeatTime="1" /></WarpMarkers></AudioClip>
						</Events><AutomationTransformViewState><IsTransformPending Value="false" /></AutomationTransformViewState></ArrangerAutomation></Sample>
						<VolumeModulationTarget Id="101"><LockEnvelope Value="0" /></VolumeModulationTarget>
					</MainSequencer>
					<FreezeSequencer><Sample><ArrangerAutomation><Events /></ArrangerAutomation></Sample><VolumeModulationTarget Id="102"><LockEnvelope Value="0" /></VolumeModulationTarget></FreezeSequencer>
				</DeviceChain>
			</AudioTrack>
			<AudioTrack Id="9">
				<LomId Value="0" />
				<Name><EffectiveName Value="Click" /><UserName Value="Click" /><Annotation Value="" /></Name>
				<Color Value="13" />
				<AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
				<TrackGroupId Value="-1" />
				<DeviceChain>
					<AudioOutputRouting><Target Value="AudioOut/External/S2" /></AudioOutputRouting>
					<Mixer><Volume><Manual Value="1" /><AutomationTarget Id="110"><LockEnvelope Value="0" /></AutomationTarget></Volume></Mixer>
					<MainSequencer>
						<ClipSlotList />
						<Sample><ArrangerAutomation><Events /><AutomationTransformViewState><IsTransformPending Value="false" /></AutomationTransformViewState></ArrangerAutomation></Sample>
						<VolumeModulationTarget Id="111"><LockEnvelope Value="0" /></VolumeModulationTarget>
					</MainSequencer>
					<FreezeSequencer><Sample><ArrangerAutomation><Events /></ArrangerAutomation></Sample></FreezeSequencer>
				</DeviceChain>
			</AudioTrack>
			<MidiTrack Id="10">
				<LomId Value="0" />
				<Name><EffectiveName Value="Lights" /><UserName Value="Lights" /><Annotation Value="" /></Name>
				<Color Value="5" />
				<DeviceChain><Mixer><Volume><Manual Value="1" /><AutomationTarget Id="120"><LockEnvelope Value="0" /></AutomationTarget></Volume></Mixer></DeviceChain>
			</MidiTrack>
		</Tracks>
		<MasterTrack>
			<LomId Value="0" />
			<Name><EffectiveName Value="Master" /><UserName Value="" /></Name>
			<AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
			<DeviceChain><Mixer>
				<Tempo><LomId Value="0" /><Manual Value="120" /><MidiControllerRange><Min Value="60" /><Max Value="200" /></MidiControllerRange><AutomationTarget Id="8"><LockEnvelope Value="0" /></AutomationTarget><ModulationTarget Id="9"><LockEnvelope Value="0" /></ModulationTarget></Tempo>
				<TimeSignature><LomId Value="0" /><Manual Value="201" /><AutomationTarget Id="10"><LockEnvelope Value="0" /></AutomationTarget></TimeSignature>
			</Mixer></DeviceChain>
		</MasterTrack>
		<Transport><PhaseNudgeTempo Value="10" /><LoopOn Value="true" /><LoopStart Value="8" /><LoopLength Value="16" /><CurrentTime Value="12" /></Transport>
		<Locators><Locators><Locator Id="0"><LomId Value="0" /><Time Value="4" /><Name Value="Marker" /><Annotation Value="" /><IsSongStart Value="false" /></Locator></Locators></Locators>
	</LiveSet>
</Ableton>
`;
