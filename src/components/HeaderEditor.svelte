<script>
  import { onMount, onDestroy } from 'svelte'
  
  export let headerText = ''
  export let headerFontSize = 16
  export let onContentChange = () => {}
  export let onSave = () => {}
  export let onFontSizeChange = () => {}
  
  let editorElement = null
  let quill = null
  const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32]
  let selectedTextSize = '16px'

  $: {
    const parsed = Number(headerFontSize)
    if (Number.isFinite(parsed)) {
      selectedTextSize = `${parsed}px`
    }
  }
  
  // Initialize Quill editor
  onMount(async () => {
    // Load Quill CSS and JS dynamically
    await loadQuill()
    
    if (editorElement) {
      const Quill = window.Quill
      const SizeStyle = Quill.import('attributors/style/size')
      SizeStyle.whitelist = FONT_SIZE_OPTIONS.map((size) => `${size}px`)
      Quill.register(SizeStyle, true)

      // Initialize Quill
      quill = new Quill(editorElement, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'size': FONT_SIZE_OPTIONS.map((size) => `${size}px`) }],
            ['bold', 'italic', 'underline'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            ['link', 'image'],
            ['clean']
          ]
        },
        placeholder: 'Click here to edit your header...'
      })
      
      // Set initial content
      if (headerText) {
        quill.root.innerHTML = headerText
      } else {
        // Set default content
        const defaultContent = `
          <h5 style="font-weight: bold; margin: 10px 0; text-align: center;">Dr. [Your Name]</h5>
          <p style="font-weight: 600; margin: 5px 0; text-align: center;">Medical Practice</p>
          <p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">City, Country</p>
          <p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">Tel: +1 (555) 123-4567 | Email: doctor@example.com</p>
          <hr style="margin: 10px 0; border: 1px solid #ccc;">
          <p style="font-weight: bold; margin: 5px 0; text-align: center;">PRESCRIPTION</p>
        `
        quill.root.innerHTML = defaultContent
        headerText = defaultContent
      }
      
      // Handle content changes
      quill.on('text-change', () => {
        const content = quill.root.innerHTML
        headerText = content
        onContentChange(content)
        onSave(content)
        
        // Make images resizable after content change
        setTimeout(() => {
          makeImagesResizable()
        }, 300)
      })

      quill.on('selection-change', () => {
        if (!quill) return
        const range = quill.getSelection()
        if (!range) return
        const format = quill.getFormat(range)
        selectedTextSize = format.size || `${headerFontSize}px`
      })
      
      // Make existing images resizable
      setTimeout(() => {
        makeImagesResizable()
      }, 400)
    }
  })
  
  // Load Quill.js dynamically
  const loadQuill = () => {
    return new Promise((resolve) => {
      // Check if already loaded
      if (window.Quill) {
        resolve()
        return
      }
      
      // Load CSS
      const cssLink = document.createElement('link')
      cssLink.rel = 'stylesheet'
      cssLink.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css'
      document.head.appendChild(cssLink)
      
      // Load JS
      const script = document.createElement('script')
      script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js'
      script.onload = () => {
        resolve()
      }
      document.head.appendChild(script)
    })
  }
  
  // Handle logo upload
  const handleLogoUpload = async (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/') && quill) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageData = e.target.result
        
        // Insert image at cursor position
        const range = quill.getSelection() || { index: 0, length: 0 }
        quill.insertEmbed(range.index, 'image', imageData)
        
        // Move cursor after the image
        quill.setSelection(range.index + 1)
        
        // Make the new image resizable
        setTimeout(() => {
          makeImagesResizable()
        }, 400)
      }
      reader.readAsDataURL(file)
      
      // Clear the input so same file can be uploaded again
      event.target.value = ''
    }
  }
  
  // Remove all images
  const removeAllImages = () => {
    if (quill) {
      const ops = quill.getContents().ops
      const newOps = ops.filter(op => op.insert?.image === undefined)
      
      quill.setContents(newOps)
    }
  }
  
  // Clear all content
  const clearContent = () => {
    if (quill) {
      quill.setContents([])
    }
  }

  const handleFontSizeSelection = (event) => {
    if (!quill) return
    selectedTextSize = event.target.value || '16px'
    quill.format('size', selectedTextSize)
    onFontSizeChange(selectedTextSize)
  }
  
  // Add resize functionality to images that works with Quill.js
  const makeImagesResizable = () => {
    if (!quill) return
    
    setTimeout(() => {
      const images = quill.container.querySelectorAll('.ql-editor img:not(.resizable)')
      
      images.forEach(img => {
        // Mark as processed
        img.classList.add('resizable')
        
        // Apply basic styling
        img.style.cssText = `
          max-width: 200px !important;
          max-height: 200px !important;
          border: 2px dashed #007bff !important;
          border-radius: 4px !important;
          margin: 5px !important;
          cursor: pointer !important;
          display: inline-block !important;
          vertical-align: top !important;
          position: relative !important;
        `
        
        // Create resize handle
        const resizeHandle = document.createElement('div')
        resizeHandle.className = 'quill-resize-handle'
        resizeHandle.innerHTML = '↘'
        resizeHandle.style.cssText = `
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background: #007bff;
          color: white;
          border: 1px solid #fff;
          cursor: se-resize;
          border-radius: 50%;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: bold;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          user-select: none;
        `
        
        // Add resize handle to image
        img.appendChild(resizeHandle)
        
        // Make image container relative for absolute positioning
        img.style.position = 'relative'
        
        // Resize functionality
        let isResizing = false
        let startX, startY, startWidth, startHeight
        
        resizeHandle.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          
          isResizing = true
          startX = e.clientX
          startY = e.clientY
          startWidth = img.offsetWidth
          startHeight = img.offsetHeight
          
          img.style.opacity = '0.8'
          resizeHandle.style.background = '#0056b3'
          
          const handleMouseMove = (e) => {
            if (!isResizing) return
            
            const newWidth = Math.max(50, startWidth + (e.clientX - startX))
            const newHeight = Math.max(50, startHeight + (e.clientY - startY))
            
            img.style.width = newWidth + 'px'
            img.style.height = newHeight + 'px'
            img.style.maxWidth = 'none'
            img.style.maxHeight = 'none'
          }
          
          const handleMouseUp = () => {
            isResizing = false
            img.style.opacity = '1'
            resizeHandle.style.background = '#007bff'
            
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
          }
          
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
        })
        
        // Hover effects
        resizeHandle.addEventListener('mouseenter', () => {
          resizeHandle.style.background = '#0056b3'
          resizeHandle.style.transform = 'scale(1.2)'
        })
        
        resizeHandle.addEventListener('mouseleave', () => {
          if (!isResizing) {
            resizeHandle.style.background = '#007bff'
            resizeHandle.style.transform = 'scale(1)'
          }
        })
      })
    }, 200)
  }
  
  // Get content
  export function getContent() {
    return headerText
  }
  
  // Cleanup
  onDestroy(() => {
    if (quill) {
      quill = null
    }
  })
</script>

<div class="header-editor-container">
  <!-- Logo Upload Section -->
  <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
    <div class="flex items-center justify-between mb-3">
      <label class="block text-sm font-medium text-blue-700">
        <i class="fas fa-image mr-2"></i>Logo & Content Management
      </label>
      <div class="flex space-x-2">
        <button 
          type="button"
          on:click={removeAllImages}
          class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
          title="Remove all images"
        >
          <i class="fas fa-trash mr-1"></i>Remove Images
        </button>
        <button 
          type="button"
          on:click={clearContent}
          class="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
          title="Clear all content"
        >
          <i class="fas fa-broom mr-1"></i>Clear All
        </button>
      </div>
    </div>
    <div class="flex items-center space-x-3">
      <input 
        type="file" 
        accept="image/*"
        on:change={handleLogoUpload}
        class="text-sm text-blue-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-500 file:text-white hover:file:bg-blue-600"
      />
      <span class="text-xs text-gray-500">
        <i class="fas fa-info-circle mr-1"></i>
        Upload logo images to insert into your header
      </span>
    </div>
  </div>

  <div class="mb-3 flex items-center gap-3">
    <label class="text-sm font-medium text-gray-700" for="header-font-size">
      <i class="fas fa-text-height mr-1"></i>Selected Text Size
    </label>
    <select
      id="header-font-size"
      class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
      value={selectedTextSize}
      on:change={handleFontSizeSelection}
    >
      {#each FONT_SIZE_OPTIONS as option}
        <option value={`${option}px`}>{option}px</option>
      {/each}
    </select>
  </div>
  
  <!-- Quill Editor -->
  <div class="editor-wrapper">
    <div bind:this={editorElement} class="quill-editor"></div>
  </div>
  
  <!-- Help Text -->
  <div class="mt-3 p-3 bg-gray-50 rounded-lg">
    <p class="text-xs text-gray-600 mb-2">
      <i class="fas fa-lightbulb mr-1"></i>
      <strong>Rich Text Editor Features:</strong>
    </p>
    <ul class="text-xs text-gray-500 space-y-1">
      <li>• <strong>Text Formatting:</strong> Bold, italic, underline, headers, colors, alignment</li>
      <li>• <strong>Font Size:</strong> Change size for selected text or next typed text</li>
      <li>• <strong>Images:</strong> Upload, drag to reposition, resize with corner handle</li>
      <li>• <strong>Auto-Save:</strong> Changes saved automatically</li>
      <li>• <strong>Image Controls:</strong> Drag to move, use blue handle to resize</li>
    </ul>
  </div>
</div>

<style>
  .header-editor-container {
    @apply w-full;
  }
  
  .editor-wrapper {
    @apply border border-gray-300 rounded-lg overflow-hidden;
  }
  
  /* Quill editor styling */
  .quill-editor {
    @apply min-h-[200px];
  }
  
  /* Simple image styling */
  :global(.ql-editor) {
    min-height: 200px !important;
  }
  
  :global(.ql-editor img) {
    max-width: 200px !important;
    max-height: 200px !important;
    border: 2px dashed #007bff !important;
    border-radius: 4px !important;
    margin: 5px !important;
    cursor: pointer !important;
    display: inline-block !important;
    vertical-align: top !important;
    position: relative !important;
  }
  
  :global(.quill-resize-handle) {
    position: absolute !important;
    bottom: -2px !important;
    right: -2px !important;
    width: 12px !important;
    height: 12px !important;
    background: #007bff !important;
    color: white !important;
    border: 1px solid #fff !important;
    cursor: se-resize !important;
    border-radius: 50% !important;
    z-index: 1000 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 8px !important;
    font-weight: bold !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
    user-select: none !important;
  }
  
  :global(.quill-resize-handle:hover) {
    background: #0056b3 !important;
    transform: scale(1.2) !important;
  }
  
  /* Keep resize functionality but hide visual editing styles in preview mode */
  :global(.template-preview .ql-editor img) {
    border: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
    cursor: default !important;
    max-width: none !important;
    max-height: none !important;
    outline: none !important;
    box-shadow: none !important;
  }
  
  /* Make resize handles more subtle in preview mode */
  :global(.template-preview .quill-resize-handle) {
    opacity: 0.3 !important;
    background: #6b7280 !important;
  }
  
  :global(.template-preview .quill-resize-handle:hover) {
    opacity: 0.8 !important;
    background: #374151 !important;
    transform: scale(1.2) !important;
  }
  
  /* Quill toolbar customization */
  :global(.ql-toolbar) {
    @apply border-b border-gray-300;
  }
  
  :global(.ql-editor) {
    @apply min-h-[200px] p-4;
    position: relative;
  }
</style>
