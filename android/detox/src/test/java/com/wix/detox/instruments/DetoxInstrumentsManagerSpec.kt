package com.wix.detox.instruments

import android.content.Context
import com.nhaarman.mockitokotlin2.*
import com.wix.detox.TestEngineFacade
import com.wix.detox.UTHelpers.yieldToOtherThreads
import com.wix.detox.instruments.DetoxInstrumentsManager
import com.wix.invoke.MethodInvocation
import org.json.JSONObject
import org.spekframework.spek2.Spek
import org.spekframework.spek2.style.specification.describe
import java.io.File
import java.lang.reflect.InvocationTargetException
import java.util.*
import java.util.concurrent.Executors

object DetoxInstrumentsManagerSpec : Spek({
    describe("Instruments manager") {
        lateinit var appContext: Context
        lateinit var instruments: Instruments
        lateinit var instrumentsManager: DetoxInstrumentsManager

        val mockCategory = "MockCategory"
        val mockName = "MockName"
        val mockId = "MockId"
        val mockAdditionalInfo = "MockAdditionalInfo"
        val mockStatus = "MockStatus"
        val mockPath = "/mock"

        beforeEachTest {
            appContext = mock()
            instruments = mock()
            instrumentsManager = DetoxInstrumentsManager(appContext, instruments)
        }

        it("should start recording when instruments installed with default params") {
            whenever(instruments.installed()).thenReturn(true)
            instrumentsManager.startRecordingAtLocalPath(mockPath)

            verify(instruments).installed()
            verify(instruments).startRecording(appContext, true, 500L, File(mockPath), false)
        }

        describe("proxy events") {
            lateinit var recording: InstrumentsRecording

            beforeEachTest {
                recording = mock()
                whenever(instruments.installed()).thenReturn(true)
                whenever(instruments.startRecording(any(), any(), any(), any(), any())).thenReturn(recording)
            }

            it("skipping without started recording") {
                instrumentsManager.eventBeginInterval(mockCategory, mockName, mockId, mockAdditionalInfo)
                instrumentsManager.eventEndInterval(mockId, mockStatus, mockAdditionalInfo)
                instrumentsManager.eventMark(mockCategory, mockName, mockId, mockStatus, mockAdditionalInfo)

                verify(recording, never()).eventBeginInterval(any(), any(), any(), any())
                verify(recording, never()).eventEndInterval(any(), any(), any())
                verify(recording, never()).eventMark(any(), any(), any(), any(), any())
            }

            it("passing within started recording") {
                instrumentsManager.startRecordingAtLocalPath(mockPath)
                instrumentsManager.eventBeginInterval(mockCategory, mockName, mockId, mockAdditionalInfo)
                instrumentsManager.eventEndInterval(mockId, mockStatus, mockAdditionalInfo)
                instrumentsManager.eventMark(mockCategory, mockName, mockId, mockStatus, mockAdditionalInfo)

                verify(recording).eventBeginInterval(any(), any(), any(), any())
                verify(recording).eventEndInterval(any(), any(), any())
                verify(recording).eventMark(any(), any(), any(), any(), any())
            }

            it("skipping with started recording which was stopped") {
                instrumentsManager.startRecordingAtLocalPath(mockPath)
                instrumentsManager.stopRecording()
                instrumentsManager.eventBeginInterval(mockCategory, mockName, mockId, mockAdditionalInfo)
                instrumentsManager.eventEndInterval(mockId, mockStatus, mockAdditionalInfo)
                instrumentsManager.eventMark(mockCategory, mockName, mockId, mockStatus, mockAdditionalInfo)

                verify(recording, never()).eventBeginInterval(any(), any(), any(), any())
                verify(recording, never()).eventEndInterval(any(), any(), any())
                verify(recording, never()).eventMark(any(), any(), any(), any(), any())
            }
        }

        it("should not start recording when instruments not installed") {
            whenever(instruments.installed()).thenReturn(false)
            instrumentsManager.startRecordingAtLocalPath(mockPath)

            verify(instruments).installed()
            verify(instruments, never()).startRecording(any(), any(), any(), any(), any())
        }

        describe("recording") {
            lateinit var recording: InstrumentsRecording

            beforeEachTest {
                recording = mock()

                whenever(instruments.installed()).thenReturn(true)
                whenever(
                        instruments.startRecording(any(), any(), any(), any(), any())
                ).thenReturn(recording)

                instrumentsManager.startRecordingAtLocalPath(mockPath)
            }

            it("should begin event interval") {
                instrumentsManager.eventBeginInterval(mockCategory, mockName, mockId, mockAdditionalInfo)
                verify(recording).eventBeginInterval(mockCategory, mockName, mockId, mockAdditionalInfo)
            }

            it("should end event interval") {
                instrumentsManager.eventEndInterval(mockId, mockStatus, mockAdditionalInfo)
                verify(recording).eventEndInterval(mockId, mockStatus, mockAdditionalInfo)
            }

            it("should mark event") {
                instrumentsManager.eventMark(mockCategory, mockName, mockId, mockStatus, mockAdditionalInfo)
                verify(recording).eventMark(mockCategory, mockName, mockId, mockStatus, mockAdditionalInfo)
            }

            it("should stop") {
                instrumentsManager.stopRecording()
                verify(recording).stop()
            }
        }
    }
})
