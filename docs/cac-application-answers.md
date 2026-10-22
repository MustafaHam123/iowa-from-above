# Iowa From Above: application answers

These are drafts based on the project's actual features and development history. Review the inspiration and learning answers so they reflect your team's experience. Describe AI assistance and each student's real contributions accurately in the submission materials.

## 1. What is the title of your app?

Iowa From Above

## 2. Explain the app's purpose.

Iowa From Above helps students and residents understand Iowa's environmental problems and find ways to help through a 3D website and an iPhone app.

The website connects environmental lessons to twelve real Iowa places. At High Trestle Bridge, for example, users can explore how runoff and field drainage carry nutrients into waterways, then learn about practices such as wetlands and stream buffers. Official USGS observations, watershed boundaries and FEMA flood maps provide evidence and geographic context. Avery, the AI guide, helps explain the selected place or data.

The iPhone app lets someone follow up on a place they explored online. A QR code opens the same location, where they can get directions, read conservation guidance and keep notes or photos from a visit. Our aim is for users to understand how environmental problems relate to places they know and leave with a clearer idea of what can help.

## 3. What inspired you to create this app?

We started with a 3D view of Iowa and wanted to give people a reason to explore it. Iowa's water challenges gave the project that purpose. A pollution measurement can be hard to connect to a place you know, especially when the source of a problem and the people affected by it are miles apart.

We wanted users to see how land upstream and communities downstream are connected. That led us to build environmental lessons around real places, including High Trestle Bridge and the Raccoon River. The phone app grew from the same idea: someone should be able to find a place they explored online and learn more when they visit.

## 4. What technical or coding difficulty did you face, and how did you address it?

One challenge was keeping environmental information attached to the right place while the drone and camera moved. The readings also needed to open when a user approached a landmark, without repeatedly reopening after the user closed them.

We use geographic coordinates to position markers in Cesium and sample heights from the existing 3D tiles. For the readings, we calculate the drone's distance from each landmark. A reading opens within about 750 metres. After a user closes it, the automatic trigger stays quiet until they move more than a kilometre away and return. That separate exit distance prevents small movements near the boundary from repeatedly opening the card.

Another issue was restoring a flight without changing completed lessons. We keep the flight state and lesson progress separate, validate the saved values, and test that reopening a solved question cannot award another boost.

## 5. What did you learn, and what was your biggest takeaway?

We learned how much the interface affects whether an idea is useful. As the project grew, we had to simplify the controls and shorten the explanations so people could understand what to do while exploring. We kept longer information available in expandable sections and made the connection between the website and phone app easier to find.

We also learned to be careful about what environmental data can tell us. A river reading needs a date, units, and context. It cannot identify a polluter or establish the safety of treated tap water. Our biggest takeaway was that showing information is only part of the work. People also need help understanding it.

## 6. What would you change in a 2.0 version?

Our first priority would be testing the app with students and Iowa residents. We would ask whether they can explain the upstream and downstream connections more clearly after using it, and whether they can find a practical next step. Their feedback would help us improve the explanations and navigation.

We would also like to add more local restoration projects and verified volunteer opportunities. Working with conservation organizations could help us keep that guidance useful and current. That would give people more specific ways to follow up on what they learned about a nearby river, wetland, or prairie.

