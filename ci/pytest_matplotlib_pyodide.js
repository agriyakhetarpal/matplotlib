// A JavaScript file to run the Matplotlib test suite using Pyodide
// This file is used by the GitHub Actions workflow to run the tests
// against the Pyodide build of Matplotlib defined in emscripten.yml.

// The contents of this file are attributed to the scikit-learn developers,
// who have a similar file in their repository:
// https://github.com/scikit-learn/scikit-learn/blob/main/build_tools/azure/pytest-pyodide.js


const { opendir } = require('node:fs/promises');
const { loadPyodide } = require("pyodide");

async function main() {
    let exit_code = 0;
    try {
        global.pyodide = await loadPyodide();
        let pyodide = global.pyodide;
        const FS = pyodide.FS;
        const NODEFS = FS.filesystems.NODEFS;

        let mountDir = "/mnt";
        pyodide.FS.mkdir(mountDir);
        pyodide.FS.mount(pyodide.FS.filesystems.NODEFS, { root: "." }, mountDir);

        await pyodide.loadPackage(["micropip"]);
        await pyodide.runPythonAsync(`
            import glob
            import micropip

            wheels = glob.glob("/mnt/dist/*.whl")
            wheels = [f'emfs://{wheel}' for wheel in wheels]
            print(f"Installing wheels: {wheels}")
            await micropip.install(wheels);

            pkg_list = micropip.list()
            print(pkg_list)

            import os
            import shutil

            import matplotlib
            matplotlib_dir = matplotlib.__file__.replace('__init__.py', '')
            print(f"Matplotlib installation directory: {matplotlib_dir}")

            # Copy fontlist.json to Matplotlib installation directory

            with open('/mnt/data/ci/emscripten/data/fontlist.json', 'rb') as f:
                fontlist = f.read()
                print(f"Writing fontlist.json to {matplotlib_dir}")
                with open(os.path.join(matplotlib_dir, 'fontlist.json'), 'wb') as f:
                    f.write(fontlist)

            # read and print contents of the file
            # DEBUGGING
            with open(os.path.join(matplotlib_dir, 'fontlist.json'), 'r') as f:
                print(f.read())

            # Copy baseline images to the Matplotlib test directory

            baseline_images_dir = '/mnt/baseline_images/lib/matplotlib/tests/baseline_images'
            os.makedirs(os.path.join(matplotlib_dir, 'tests', 'baseline_images'), exist_ok=True)
            test_baseline_images_dir = os.path.join(matplotlib_dir, 'tests', 'baseline_images')
            for root, dirs, files in os.walk(baseline_images_dir):
                for file in files:
                    with open(os.path.join(root, file), 'rb') as f:
                        data = f.read()
                        with open(os.path.join(test_baseline_images_dir, file), 'wb') as f:
                            f.write(data)

            # print the contents of the baseline images directory
            # DEBUGGING
            print(os.listdir(test_baseline_images_dir))
        `);


        await pyodide.runPythonAsync("import micropip; micropip.install('pytest<8.1.0')");
        // change to matplotlib test directory before running pytest
        pyodide.FS.chdir('/mnt/lib/python3.11/site-packages/matplotlib/tests');
        let pytest = pyodide.pyimport("pytest");
        let args = process.argv.slice(2);
        // test without args for now
        console.log('pytest args:', args);
        exit_code = pytest.main(pyodide.toPy(args));
    } catch (e) {
        console.error(e);
        // Arbitrary exit code here. I have seen this code reached instead of a
        // Pyodide fatal error sometimes
        exit_code = 66;

    } finally {
        process.exit(exit_code);
    }
}

main();
