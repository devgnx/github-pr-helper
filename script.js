// https://gist.github.com/devgnx/de133f345d43d8389b68e2116cdbeaba

(function () {
  function initialize() {
    if (showOnlyCurrentCommits()) {
      return;
    }

    // TODO: sum lines added & removed from .sr-only on each file (useful for mixed commits PR)
    // i.e.: 4 changes: 2 additions & 2 deletions

    // TODO: add only branch name in clipboard when clicking on 'copy branch name' button
    // TODO: have a shortcut to switch between split & unifed diffs
    // hide left side columns for new files or additions-only changes

    waitLoading(() => {
      loopFiles(function ($file) {
        renderCommentCounters.call(this, $file);
        openViewedWithComments.call(this, $file);
        loadLargeDiff.call(this, $file).then(() => {
          hideLeftSideForAdditionsOnly.call(this, $file);
          handleTests.call(this, $file);
        });
      });

      foldAll();
      toggleDiffView();
    })
  }

  function waitLoading(callback) {
    let previousTimeout = setTimeout(() => {
      clearTimeout(previousTimeout);
      isStillLoading() ? waitLoading(callback) : callback();
    }, 200);
  }

  function isStillLoading() {
    return $('.js-diff-progressive-container:last-of-type > include-fragment').length > 0
      || $('.selected.tabnav-tab:contains("Files changed")').length === 0;
  }

  function getCommentCount($file) {
    return $file.find('.inline-comments').length;
  }

  function isViewed($file) {
    return $file.find('[name="viewed"]').is(':checked');
  }

  function handleTests($testFile) {
    if (!isTestFile($(this))) return;

    const actualFileName = getFileName($(this)).split('/').slice(-2).join('/').replace(/(Test|\.test)(\.php|\.js)/g, '$2');
    const $actualFile = $('.Link--primary.Truncate-text').filter(function () {
      return (new RegExp(actualFileName, "i")).test($(this).attr('title'));
    }).parents('[data-details-container-group="file"]');

    // Disabling move test
    // if ($actualFile.length) {
    //   $testFile.insertAfter($actualFile);
    // }

    highlightTestFile($testFile);
    toggleExpand($testFile);
  }

  function isTestFile($file) {
    return getFileName($file).match(/Test\.php|\.test\.js|_spec\.js|spec\/cypress/);
  }

  function getFileName($file) {
    let fileName = $file.attr('data-path') || $file.attr('data-tagsearch-path') || $file.attr('title');
    return fileName.replace(/.*→/gi, '').trim();
  }

  function toggleExpand($file) {
    const $fileParent = $file.closest('[data-details-container-group="file"]');
    let $testFile;
    let $actualFile;

    if (isTestFile($file)) {
      $testFile = $fileParent;
      $actualFile = $testFile.prev('[data-details-container-group="file"]');
    } else {
      $actualFile = $fileParent;
      $testFile = $actualFile.next('[data-details-container-group="file"]');
    }

    // Validate that the files are actually related before pairing them
    const shouldPair = false; 

    // Disabling shouldPair, do not mess up with the files width
    // const shouldPair = areFilesRelated($actualFile, $testFile);

    const $copilotEntry = $fileParent.parents('copilot-diff-entry');
    
    if ($copilotEntry.length === 0 || $copilotEntry.hasClass('overridden')) {
      return;
    }

    if ($actualFile.length > 0) {
      $actualFile.toggleClass('wide');
    }

    // Only apply flex styles if files should be paired
    if (shouldPair) {
      // Expand actual & test files side by side
      $copilotEntry.css({
        display: 'flex',
        'flex-wrap': 'nowrap',
        'gap': '10px',
        'margin-left': '-22px',
        'margin-right': '-22px'
      });

      $([$actualFile.get(0), $testFile.get(0)]).css({
        'flex': '1 50%',
        'max-width': '50%'
      });

      // After basic toggle, check if we need to override for readability
      handleFullWidthOverride($copilotEntry);
    } else {
      // Don't modify copilot-diff-entry for unpaired files, leave default behavior
      // Just ensure the file itself isn't constrained
      $fileParent.css({
        'flex': '',
        'max-width': ''
      });
    }

    setTimeout(() => {
      window.scrollTo(0, $fileParent.find('.js-file-content').offset().top - 60);
    });
  }

  function areFilesRelated($actualFile, $testFile) {
    // Both must exist and be in the same copilot-diff-entry container
    if ($actualFile.length === 0 || $testFile.length === 0) {
      return false;
    }

    // Check if they're in the same copilot-diff-entry
    const $actualParent = $actualFile.parents('copilot-diff-entry');
    const $testParent = $testFile.parents('copilot-diff-entry');
    if ($actualParent.get(0) !== $testParent.get(0)) {
      return false;
    }

    // Check if the test file is actually a test file
    if (!isTestFile($testFile.find('.Link--primary.Truncate-text'))) {
      return false;
    }

    // Check if filenames are related using the same logic as handleTests
    const actualFileName = getFileName($actualFile.find('.Link--primary.Truncate-text'));
    const testFileName = getFileName($testFile.find('.Link--primary.Truncate-text'));
    
    // Use the same pattern matching as handleTests
    const expectedPattern = testFileName.split('/').slice(-2).join('/').replace(/(Test|\.test)(\.php|\.js)/g, '$2');
    return (new RegExp(expectedPattern, "i")).test(actualFileName);
  }

  function handleFullWidthOverride($copilotEntry) {
    const $filesInEntry = $copilotEntry.find('[data-details-container-group="file"]');

    if ($filesInEntry.length <= 1) return;

    let filesWithBothSides = 0;
    $filesInEntry.each(function () {
      const $currentFile = $(this);
      const $leftCells = $currentFile.find('[data-split-side="left"]');
      const $rightCells = $currentFile.find('[data-split-side="right"]');

      if ($leftCells.length > 0 && $rightCells.length > 0) {
        // Check if there are actual changes (not just empty cells)
        const hasLeftChanges = $leftCells.filter('.blob-code-deletion').length > 0;
        const hasRightChanges = $rightCells.filter('.blob-code-addition').length > 0;

        if (hasLeftChanges && hasRightChanges) {
          filesWithBothSides++;
        }
      }
    });

    // If multiple files have both sides, override to full width for better readability
    if (filesWithBothSides > 0) {
      $copilotEntry.addClass('overridden').css({
        'display': 'block'
      });

      $filesInEntry.css({
        'flex': '1 100%',
        'max-width': '100%'
      });
    }
  }

  function highlightTestFile($file) {
    let color = '#251414';
    const text = $file.find('.blob-code-inner').text();
    if (!text.match('namespace') || text.match('namespace Soci\\\\Tests')) {
      color = '#1c1425';
    }

    $file.children('.file-header').css('background-color', color);
  }

  function loadLargeDiff($file) {
    return new Promise((resolve) => {
      const $loadButton = $file.find('.js-file-content .load-diff-button');

      // If there's no load button, the diff is already loaded
      if ($loadButton.length === 0) {
        resolve();
        return;
      }

      // If diff-table already exists, no need to load
      if ($file.find('.diff-table').length > 0) {
        resolve();
        return;
      }

      // Click the load button
      $loadButton.click().blur();

      // Wait for the diff-table to appear
      const checkForDiffTable = () => {
        if ($file.find('.diff-table').length > 0) {
          resolve();
        } else {
          setTimeout(checkForDiffTable, 100);
        }
      };

      checkForDiffTable();
    });
  }

  function hideLeftSideForAdditionsOnly($file) {
    const $leftCells = $file.find('[data-split-side="left"]');
    const $rightCells = $file.find('[data-split-side="right"]');

    if ($leftCells.length === 0 || $rightCells.length === 0) return;

    // Check if left side is completely empty (new files)
    let allEmpty = true;
    $leftCells.each(function () {
      if (!$(this).hasClass('blob-code-empty empty-cell')) {
        allEmpty = false;
        return false;
      }
    });

    // Check if left side has no deletions (only context lines, no actual changes)
    let hasLeftChanges = $leftCells.filter('.blob-code-deletion').length > 0;

    if ((allEmpty && $file.find('.blob-num.blob-num-empty.empty-cell').length > 0) ||
      (!hasLeftChanges && $rightCells.filter('.blob-code-addition').length > 0)) {

      // Remove all left side elements
      $file.find('.blob-num.blob-num-empty.empty-cell, [data-split-side="left"]').remove();

      // For files with context lines, also remove left line numbers
      if (!allEmpty) {
        $file.find('.js-file-content tr').each(function () {
          $(this).find('[data-line-number]+[data-line-number]').prev().remove(); // Remove left line number
        });
      }

      // Clean up any remaining empty td elements
      $file.find('.js-file-content tr').each(function () {
        const $row = $(this);
        const $cells = $row.find('td');

        // Remove empty td elements (those without content or classes)
        $cells.each(function () {
          const $cell = $(this);
          if ($cell.html().trim() === '' && !$cell.hasClass('blob-code') && !$cell.hasClass('blob-num')) {
            $cell.remove();
          }
        });
      });

      // Update table layout
      $file.find('.js-file-content table').css('table-layout', 'fixed');

      // Set proper widths for remaining cells
      $file.find('.js-file-content tr').each(function () {
        const $cells = $(this).find('td');
        if ($cells.length === 2) {
          $cells.eq(0).css('width', '50px');
          $cells.eq(1).css('width', 'calc(100% - 50px)');
        } else if ($cells.length === 1) {
          // For hunk headers that span the full width
          $cells.eq(0).css('width', '100%');
        }
      });

      // Update table structure
      $file.find('.js-file-content thead tr').each(function () {
        $(this).find('th, td').slice(0, 2).remove();
      });
      $file.find('.diff-table colgroup col').slice(0, 2).remove();
      $file.find('.diff-table col:last-child').attr('width', '100%');
    }
  }

  function renderCommentCounters($file) {
    const commentsCount = getCommentCount($file);
    const greenColor = 'var(--bgColor-success-emphasis, var(--color-success-emphasis))';
    const redColor = 'var(--bgColor-danger-emphasis, var(--color-danger-emphasis))';
    const backgroundColor = commentsCount > 0 ? redColor : greenColor;
    const $commentCounter = $('<span/>')
      .text(commentsCount)
      .addClass('Counter')
      .css({
        position: 'absolute',
        transform: 'scale(.6)',
        top: 0,
        right: 0,
        backgroundColor
      });

    $file.find('button.js-add-file-comment').append($commentCounter);
  }

  function openViewedWithComments($file) {
    if (getCommentCount($file) > 0 && isViewed($file)) {
      fold($file);
    }
  }

  function scrollNextComment(e) {
    const $comments = $('.line-comments');
    const currentScrollY = window.scrollY;

    if (!$comments.length) return;

    $comments.each(function () {
      const $comment = $(this);
      const commentHeight = $comment.height();
      const commentScrollY = $comment.offset().top;
      if (commentScrollY > (currentScrollY + commentHeight)) {
        scrollToComment(e, $comment);
        return false;
      }
    });
    setTimeout(() => {
      if (window.scrollY === currentScrollY) {
        scrollToComment(e, $comments.first());
      }
    }, 100);
  }

  function scrollToComment(e, $comment) {
    e.preventDefault();

    const $fileClosed = $comment.parents('[data-details-container-group="file"]:not(.Details--on)');
    $fileClosed.length && !isViewed($fileClosed) && fold($fileClosed);

    setTimeout(() => {
      window.scrollTo(0, $comment.offset().top - 120);
    });
  }

  function foldCurrent(e) {
    const headers = document.querySelectorAll('.file-header');
    const selected = headers.values().find(element => element.parentNode.matches(":hover"));
    if (selected && !$(e.target).is(':input')) {
      e.preventDefault();
      fold($(selected));
    }
  }

  function fold($file) {
    $file.find('[aria-label="Toggle diff contents"]').click();
  }

  function showOnlyCurrentCommits() {
    const PRName = $('.js-issue-title').text();
    const ticket = PRName.match(/^\w+\-\d+\s/g)?.[0]?.trim();

    if (!ticket) {
      return false;
    }

    const menuItems = $('[data-range-url*="/files/$range"] [role="menuitem"]');
    const ticketCommits = menuItems.filter(`:contains("${ticket}")`);

    if (menuItems.length === ticketCommits.length) {
      return false;
    }

    const startCommit = ticketCommits.first().attr('data-parent-commit');
    const endCommit = ticketCommits.last().attr('data-commit');

    if (!startCommit) {
      return false;
    }

    const newUrl = window.location.href.replace(/files\/?([0-9a-z]+)?(\.\.)?([0-9a-z]+)?/, `files/${startCommit}..${endCommit}`);

    if (window.location.href !== newUrl) {
      window.location.href = newUrl;
      return true;
    }

    return false;
  }

  function toggleDiffView() {
    const linesChanged = new Number($('#diffstat .color-fg-success').text());
    const filesChanged = new Number($('#files_tab_counter').attr('title'));

    if (linesChanged < 1000 && filesChanged < 6) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (!params.has('diff') || ['unified', 'split'].includes(params.get('diff'))) {
      params.set('diff', 'split');
      window.history.pushState({}, '', `?${params.toString()}`);
    }

    loopFiles(toggleExpand);
  }

  function injectCss(css) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  // Inject CSS styles for the script functionality
  injectCss(`
    copilot-diff-entry.overridden {
      position: relative;
    }
    
    copilot-diff-entry.overridden::after {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      display: block;
      content: "";
      border: 2px solid purple;
      pointer-events: none;
      z-index: 1;
    }
    
    /* Fix comment forms in side-by-side layout */
    copilot-diff-entry.has-comment-form {
      display: block !important;
    }
    
    copilot-diff-entry.has-comment-form > [data-details-container-group="file"] {
      flex: 1 100% !important;
      max-width: 100% !important;
    }
    
    /* Fix expanded lines in side-by-side layout */
    copilot-diff-entry.has-expanded-lines {
      display: block !important;
    }
    
    copilot-diff-entry.has-expanded-lines > [data-details-container-group="file"] {
      flex: 1 100% !important;
      max-width: 100% !important;
    }
  `);

  window.loopFiles = (callback) => {
    $('.Link--primary.Truncate-text').each(function () {
      const $file = $(this).parents('[data-details-container-group="file"]');
      callback.call(this, $file);
    });
  }

  const actions = { INITIAL: 0, CLOSE_ALL: 1, OPEN_ALL: 2, CLOSE_VIEWED: 3 };
  let nextAction = actions.CLOSE_ALL;

  function foldNextAction($file, action) {
    fold($file);
    nextAction = action;
  }

  window.foldSequence = function () {
    const $allParents = $('[data-details-container-group="file"]');
    const $filesOpen = $allParents.filter('.Details--on');
    const $filesClosed = $allParents.filter(':not(.Details--on)');
    const $filesViewed = $allParents.filter(function () {
      return $(this).find('[name="viewed"]').is(':checked');
    });

    if (nextAction === actions.CLOSE_ALL && $allParents.length === $filesClosed.length) {
      nextAction = actions.OPEN_ALL;
    }

    switch (nextAction) {
      case actions.INITIAL: foldNextAction($allParents.not($filesViewed), actions.CLOSE_ALL); break;
      case actions.CLOSE_ALL: foldNextAction($filesOpen, actions.OPEN_ALL); break;
      case actions.OPEN_ALL: foldNextAction($filesClosed, actions.CLOSE_VIEWED); break;
      case actions.CLOSE_VIEWED: foldNextAction($allParents.not($filesViewed), actions.CLOSE_ALL); break;
    }
  }

  window.foldAll = function () {
    foldNextAction($('.Details--on[data-details-container-group="file"]'), actions.INITIAL);
  };

  // Detect and handle comment forms
  function setupCommentFormDetection() {
    // Watch for comment forms being added/removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const $node = $(node);
            // Check if this is a comment form or contains one
            if ($node.hasClass('js-inline-comment-form') || $node.find('.js-inline-comment-form').length > 0) {
              const $copilotEntry = $node.closest('copilot-diff-entry');
              if ($copilotEntry.length > 0) {
                // Store original styles for files in this entry
                const $files = $copilotEntry.find('[data-details-container-group="file"]');
                $files.each(function() {
                  const $f = $(this);
                  if (!$f.data('original-flex')) {
                    $f.data('original-flex', $f.css('flex'));
                    $f.data('original-max-width', $f.css('max-width'));
                  }
                });
                
                // Add class and adjust styles
                $copilotEntry.addClass('has-comment-form');
                $copilotEntry.css('display', 'block');
                $files.css({
                  'flex': '1 1 100%',
                  'max-width': '100%'
                });
              }
            }
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const $node = $(node);
            if ($node.hasClass('js-inline-comment-form') || $node.find('.js-inline-comment-form').length > 0) {
              const $copilotEntry = $node.closest('copilot-diff-entry');
              if ($copilotEntry.length > 0) {
                // Check if there are any remaining comment forms
                setTimeout(() => {
                  if ($copilotEntry.find('.js-inline-comment-form').length === 0) {
                    $copilotEntry.removeClass('has-comment-form');
                    $copilotEntry.css('display', '');
                    
                    // Restore original styles
                    const $files = $copilotEntry.find('[data-details-container-group="file"]');
                    $files.each(function() {
                      const $f = $(this);
                      $f.css({
                        'flex': $f.data('original-flex') || '',
                        'max-width': $f.data('original-max-width') || ''
                      });
                    });
                  }
                }, 100);
              }
            }
          }
        });
      });
    });

    // Observe the entire diff container
    const diffContainer = document.querySelector('#files');
    if (diffContainer) {
      observer.observe(diffContainer, {
        childList: true,
        subtree: true
      });
    }
  }
  
  // Handle expand button clicks
  function setupExpandButtonHandling() {
    $(document).on('click', '.js-expand-full, .js-expand-up, .js-expand-down', function() {
      const $button = $(this);
      const $file = $button.closest('[data-details-container-group="file"]');
      const $copilotEntry = $file.parents('copilot-diff-entry');
      
      if ($copilotEntry.length > 0) {
        // Store original styles for the copilot entry
        if (!$copilotEntry.data('original-display')) {
          $copilotEntry.data('original-display', $copilotEntry.css('display'));
        }
        
        // Store original styles for files
        const $files = $copilotEntry.find('[data-details-container-group="file"]');
        $files.each(function() {
          const $f = $(this);
          if (!$f.data('original-flex')) {
            $f.data('original-flex', $f.css('flex'));
            $f.data('original-max-width', $f.css('max-width'));
            $f.data('original-width', $f.css('width'));
          }
        });
        
        // Temporarily disable flex layout and expand files
        $copilotEntry.addClass('has-expanded-lines');
        $copilotEntry.css('display', 'block');
        $files.css({
          'flex': 'none',
          'max-width': 'none',
          'width': '100%'
        });
        
        // Force table layout recalculation
        $file.find('table.diff-table').css('table-layout', 'auto');
        
        // Don't auto-restore - let it stay expanded
        // The user can click collapse to restore
      }
    });
    
    // Handle collapse button
    $(document).on('click', '.js-collapse-diff', function() {
      const $button = $(this);
      const $file = $button.closest('[data-details-container-group="file"]');
      const $copilotEntry = $file.parents('copilot-diff-entry');
      
      if ($copilotEntry.length > 0) {
        $copilotEntry.removeClass('has-expanded-lines');
        
        // Restore original layout
        const originalDisplay = $copilotEntry.data('original-display');
        if (originalDisplay) {
          $copilotEntry.css('display', originalDisplay);
        } else {
          $copilotEntry.css('display', '');
        }
        
        const $files = $copilotEntry.find('[data-details-container-group="file"]');
        $files.each(function() {
          const $f = $(this);
          $f.css({
            'flex': $f.data('original-flex') || '',
            'max-width': $f.data('original-max-width') || '',
            'width': $f.data('original-width') || ''
          });
        });
        
        // Reset table layout
        $file.find('table.diff-table').css('table-layout', '');
      }
    });
  }

  jQueryReady = function ($) {
    $(initialize);
    $(document).on('click', '.stale-files-tab-link', initialize);
    //$(document).on('click', '.tabnav-tab:contains("Files changed")', () => setTimeout(initialize, 2000));
    $(document).on('click', '[data-details-container-group="file"]', function (e) { e.ctrlKey && fold($(this)); });
    $(document).on('dblclick', '[data-details-container-group="file"] .file-header', function (e) { foldCurrent(e); });
    $(document).on("keydown", (e) => {
      const combo = e.ctrlKey && e.shiftKey;
      if (combo && e.key.toUpperCase() === "F") {
        foldSequence();
      } else if (e.key === " ") {
        combo ? scrollNextComment(e) : foldCurrent(e);
      } else if (combo && e.key.toUpperCase() === "S") {
        showOnlyCurrentCommits();
      }
    });
    
    // Setup comment form detection and expand button handling after page loads
    setupCommentFormDetection();
    setupExpandButtonHandling();
  }

  // wait until jQuery is loaded
  function waitForJQuery(callback) {
    if (typeof jQuery !== 'undefined') {
      callback(jQuery);
    } else {
      setTimeout(() => waitForJQuery(callback), 100);
    }
  }

  waitForJQuery(jQueryReady);
})();
