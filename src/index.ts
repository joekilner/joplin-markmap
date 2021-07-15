import joplin from 'api';
import { Transformer } from 'markmap-lib';

joplin.plugins.register({
	onStart: async function() {// Create the panel object
		console.info('Registering mind map plugin xx');
		const panel = await joplin.views.panels.create("markmap");
		// Add the JS file to the view, right after it has been created:
		await joplin.views.panels.addScript(panel, './d3.js');
		await joplin.views.panels.addScript(panel, './markmap-view.js');

		window["panel"] = panel;
		window["joplin"] = joplin;

		// Set some initial content while the TOC is being created
		await joplin.views.panels.setHtml(panel, 'Loading...');
		await joplin.views.panels.show(panel);

		// Later, this is where you'll want to update the TOC
		async function updateMindMapRender() {
			console.info('Updating mind map');
			// Get the current note from the workspace.
			const note = await joplin.workspace.selectedNote();

			// Keep in mind that it can be `null` if nothing is currently selected!
			if (note) {
				console.info('Note content has changed! New note is:', note);

				console.info('Processing note contents');
				const transformer = new Transformer();
				// 1. transform markdown
				const { root, features } = transformer.transform(note.body);

				console.info('transformed note contents');
				// 2. get assets
				// either get assets required by used features
				const { styles, scripts } = transformer.getUsedAssets(features);
				// or get all possible assets that could be used later
				// const { styles, scripts } = transformer.getAssets();
				console.info('got note assets');

				await joplin.views.panels.onMessage(panel, (message:any) => {
					console.log("Got message: " + message)
					if (message === "style")
						return styles;
					if (message === "scripts")
						return scripts;
					if (message === "root")
						return root;
				});

				// Finally, insert all the headers in a container and set the webview HTML:
				await joplin.views.panels.setHtml(panel, `
					<div class="container">
						<svg id="markmap-target" style="width: 800px; height: 800px"></svg>
						<script>
							const styles = await webviewApi.postMessage("styles");
							const scripts = await webviewApi.postMessage("scripts");
							const root = await webviewApi.postMessage("root");
							console.log("Styles = ", styles);
							console.log("Scripts = ", scripts);
							console.log("Root = ", root);

							// load with <script>
							const { markmap } = window;
							const { Markmap, loadCSS, loadJS } = markmap;

							// 1. load assets
							if (styles) loadCSS(styles);
							if (scripts) loadJS(scripts, { getMarkmap: () => markmap });

							// 2. create markmap
							// \`options\` is optional, i.e. \`undefined\` can be passed here
							Markmap.create('#markmap-target', options, root);
						</script>
					</div>
				`);
				console.info('Rendered into webview');
			} else {
				console.info('No note is selected');
			}
		}

		// This event will be triggered when the user selects a different note
		await joplin.workspace.onNoteSelectionChange(() => {
			console.info('Note selection changed');
			updateMindMapRender();
		});

		// This event will be triggered when the content of the note changes
		// as you also want to update the TOC in this case.
		await joplin.workspace.onNoteChange(() => {
			console.info('Note content changed');
			updateMindMapRender();
		});

		// Also update the TOC when the plugin starts
		await updateMindMapRender();
	},
});
